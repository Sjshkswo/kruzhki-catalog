const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');
const { serverError } = require('../utils/errors');

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sign = (u) => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = (u) => ({ id: u.id, full_name: u.full_name, email: u.email, phone: u.phone, role: u.role });

router.post('/register', async (req, res) => {
  const { full_name, email, password, phone } = req.body;
  if (!full_name || full_name.trim().length < 2) return res.status(400).json({ error: 'Укажите ФИО' });
  if (!emailRe.test(email || '')) return res.status(400).json({ error: 'Неверный email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });
  const userRole = 'parent'; // R-1: все регистрируются родителями; организатором становятся через заявку
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, lower($2), $3, $4, $5) RETURNING *`,
      [full_name.trim(), email, bcrypt.hashSync(password, 10), phone || null, userRole]
    );
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
    serverError(res, e);
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email = lower($1)', [email || '']);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password || '', user.password_hash))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  if (user.is_blocked) return res.status(403).json({ error: 'Аккаунт заблокирован' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
