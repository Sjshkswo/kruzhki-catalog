require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');

if (!process.env.JWT_SECRET) {
  console.error('Не задан JWT_SECRET: скопируйте .env.example в .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/organizer', require('./routes/organizer'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Единый обработчик ошибок (например, async-ошибки в маршрутах)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Ошибка сервера' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API запущен: http://localhost:${port}`));
