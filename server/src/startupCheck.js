// Проверка окружения перед запуском сервера: понятные подсказки вместо длинных ошибок.
require('dotenv').config();
const pool = require('./db/pool');

async function runChecks() {
  const results = [];
  // hint показывается только если проверка не пройдена; note – пояснение к пройденной проверке
  const add = (ok, title, hint = '', note = '') => results.push({ ok, title, hint: ok ? note : hint });

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 18, `Node.js ${process.versions.node}`, 'Нужна версия 18 или новее: https://nodejs.org');
  add(!!process.env.DATABASE_URL, 'DATABASE_URL задан в server/.env',
    'Создайте файл server/.env (скопируйте .env.example) и впишите DATABASE_URL с паролем от PostgreSQL');
  add(!!process.env.JWT_SECRET, 'JWT_SECRET задан в server/.env',
    'Впишите в server/.env любую длинную строку в JWT_SECRET (например, набор случайных букв и цифр)');

  if (process.env.DATABASE_URL) {
    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
      add(true, 'Подключение к базе данных');
    } catch (e) {
      add(false, `Подключение к базе данных (${e.code || e.message})`,
        'Проверьте: 1) запущен ли PostgreSQL; 2) верны ли пароль и имя базы в DATABASE_URL; 3) создана ли база kruzhki (pgAdmin → Databases → Create)');
    }
    if (dbOk) {
      let migrated = false;
      try {
        const r = await pool.query("SELECT 1 FROM pgmigrations WHERE name = '005_consolidated_schema'");
        migrated = r.rowCount === 1;
      } catch (e) { /* таблицы миграций ещё нет */ }
      add(migrated, 'Миграции базы данных применены', 'В папке server выполните: npm run db:init');
      if (migrated) {
        const u = await pool.query('SELECT COUNT(*)::int AS n FROM users');
        add(true, `Пользователей в базе: ${u.rows[0].n}`, '', u.rows[0].n === 0 ? 'База пустая. Для демо-данных выполните: npm run db:seed' : '');
      }
    }
  }
  return results;
}

module.exports = { runChecks };
