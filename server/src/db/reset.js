// ПОЛНЫЙ СБРОС базы (удаляет все данные!): npm run db:reset
// Только для разработки: на рабочем сервере (NODE_ENV=production) отказывается работать.
require('dotenv').config();
const pool = require('./pool');
const migrate = require('./init');

(async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('ОТКАЗ: db:reset нельзя запускать при NODE_ENV=production.');
    process.exit(1);
  }
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate();
  console.log('База сброшена, миграции применены. Теперь можно выполнить: npm run db:seed');
  await pool.end();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
