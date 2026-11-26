// Применяет миграции: npm run db:init
// Безопасно: ничего не удаляет, можно запускать сколько угодно раз (в том числе на рабочей базе).
require('dotenv').config();
const path = require('path');
const { default: runner } = require('node-pg-migrate');

async function migrate() {
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
    .then(() => { console.log('Миграции применены'); process.exit(0); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
