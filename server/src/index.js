require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const { runChecks } = require('./startupCheck');
const { serverError } = require('./utils/errors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/children', require('./routes/children'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/organizer', require('./routes/organizer'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Единый обработчик ошибок (например, async-ошибки в маршрутах)
app.use((err, req, res, next) => serverError(res, err));

const port = process.env.PORT || 4000;

(async () => {
  // Перед запуском проверяем окружение и сразу объясняем, что не так
  const bad = (await runChecks()).filter((r) => !r.ok);
  if (bad.length) {
    console.error('\nСервер не может запуститься:\n');
    bad.forEach((r) => console.error(`  ✗ ${r.title}\n      → ${r.hint}`));
    console.error('\nПолная проверка окружения: npm run check\n');
    process.exit(1);
  }
  const server = app.listen(port, () => console.log(`API запущен: http://localhost:${port}`));
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\nПорт ${port} уже занят. Скорее всего, сервер уже запущен в другом окне терминала: закройте его (Ctrl+C) и запустите снова.\n`);
    else console.error(e);
    process.exit(1);
  });
})();
