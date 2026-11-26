// Проверка окружения перед запуском сервера: понятные подсказки вместо длинных ошибок.
require('dotenv').config();
const pool = require('./db/pool');

async function runChecks() {
  const results = [];

  const add = (ok, title, hint = '', note = '') =>
    results.push({ ok, title, hint: ok ? note : hint });

  const major = Number(process.versions.node.split('.')[0]);

  add(
    major >= 18,
    `Node.js ${process.versions.node}`,
    'Нужна версия 18 или новее: https://nodejs.org'
  );

  add(
    !!process.env.DATABASE_URL,
    'DATABASE_URL задан в server/.env',
    'Создайте server/.env на основе .env.example и укажите DATABASE_URL'
  );

  add(
    !!process.env.JWT_SECRET,
    'JWT_SECRET задан в server/.env',
    'Укажите длинную случайную строку в JWT_SECRET'
  );

  if (process.env.DATABASE_URL) {
    let dbOk = false;

    try {
      await pool.query('SELECT 1');
      dbOk = true;
      add(true, 'Подключение к базе данных');
    } catch (e) {
      add(
        false,
        `Подключение к базе данных (${e.code || e.message})`,
        'Проверьте запуск PostgreSQL и настройки DATABASE_URL'
      );
    }

    if (dbOk) {
      let migrated = false;

      try {
        const result = await pool.query(`
          SELECT COUNT(*)::int AS count
          FROM pgmigrations
          WHERE name IN ('001_initial', '002_notifications')
        `);

        migrated = result.rows[0].count === 2;
      } catch (e) {
        // Таблица миграций ещё не создана.
      }

      add(
        migrated,
        'Миграции базы данных применены',
        'В папке server выполните: npm run db:init'
      );

      if (migrated) {
        const users = await pool.query(
          'SELECT COUNT(*)::int AS n FROM users'
        );

        add(
          true,
          `Пользователей в базе: ${users.rows[0].n}`,
          '',
          users.rows[0].n === 0
            ? 'База пустая. Для демо-данных выполните: npm run db:seed'
            : ''
        );
      }
    }
  }

  return results;
}

module.exports = { runChecks };
