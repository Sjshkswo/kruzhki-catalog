// ПОЛНЫЙ СБРОС базы (удаляет все данные!): npm run db:reset
// Только для разработки. Не запускайте, если нужно сохранить данные.
require('dotenv').config();
const { Pool } = require('pg');
const migrate = require('./init');

(async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ОТКАЗ: db:reset нельзя запускать при NODE_ENV=production.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Не задан DATABASE_URL в server/.env');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('DROP SCHEMA public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  } finally {
    await pool.end();
  }

  await migrate();
  console.log('База полностью сброшена, миграции применены. Теперь можно выполнить: npm run db:seed');
  process.exit(0);
})().catch((e) => {
  console.error('Ошибка сброса базы:', e.message);
  process.exit(1);
});
