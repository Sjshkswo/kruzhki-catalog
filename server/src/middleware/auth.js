const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Проверяет токен и кладёт пользователя в req.user
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется вход' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, full_name, email, phone, role, is_blocked FROM users WHERE id = $1',
      [payload.id]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (user.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Неверный или просроченный токен' });
  }
}

// Разрешает доступ только перечисленным ролям
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Недостаточно прав' });

module.exports = { auth, requireRole };
