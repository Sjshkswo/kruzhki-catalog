require('dotenv').config();

const path = require('path');
const { Pool } = require('pg');
const { default: runner } = require('node-pg-migrate');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Не задан DATABASE_URL в server/.env');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(`
      SELECT
        to_regclass('public.users') AS users_table,
        to_regclass('public.notifications') AS notifications_table,
        to_regclass('public.pgmigrations') AS migrations_table
    `);

    const state = result.rows[0];

    // Проверяем существующую базу, не изменяя её.
    if (state.migrations_table) {
      const migrations = await pool.query(`
        SELECT name
        FROM public.pgmigrations
      `);

      const applied = new Set(migrations.rows.map(row => row.name));

      if (state.users_table && !applied.has('001_initial')) {
        throw new Error(
          'Обнаружена существующая таблица users, но 001_initial отсутствует в журнале. ' +
          'Автоматическое принятие старой схемы запрещено.'
        );
      }

      if (state.notifications_table && !applied.has('002_notifications')) {
        throw new Error(
          'Обнаружена таблица notifications, но 002_notifications отсутствует в журнале. ' +
          'Автоматическое принятие старой схемы запрещено.'
        );
      }
    } else {
      // Если таблицы проекта уже существуют без журнала,
      // нельзя безопасно определить, какие миграции применены.
      if (state.users_table || state.notifications_table) {
        throw new Error(
          'Обнаружены существующие таблицы без журнала pgmigrations. ' +
          'Автоматический запуск остановлен во избежание повреждения данных.'
        );
      }
    }
  } finally {
    await pool.end();
  }

  await runner({
    databaseUrl: process.env.DATABASE_URL,
    dir: path.join(__dirname, '..', '..', 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: () => {},
  });
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Миграции применены');
      process.exit(0);
    })
    .catch(error => {
      console.error('Ошибка применения миграций:', error.message);
      process.exit(1);
    });
}
