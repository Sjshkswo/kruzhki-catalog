// Создаёт таблицы: npm run db:init
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Таблицы созданы');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
