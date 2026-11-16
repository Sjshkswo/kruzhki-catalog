const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { notifyStatusChange } = require('../mailer');

router.use(auth, requireRole('admin'));

router.get('/users', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, phone, role, is_blocked, created_at FROM users ORDER BY id');
  res.json(rows);
});

router.patch('/users/:id/block', async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
  const { rows } = await pool.query(
    `UPDATE users SET is_blocked = NOT is_blocked WHERE id = $1 AND role <> 'admin' RETURNING id, is_blocked`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json(rows[0]);
});

router.get('/clubs', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.is_active, u.full_name AS organizer_name, cat.name AS category_name
     FROM clubs c JOIN users u ON u.id = c.organizer_id JOIN categories cat ON cat.id = c.category_id
     ORDER BY c.id`);
  res.json(rows);
});

router.patch('/clubs/:id/hide', async (req, res) => {
  const { rows } = await pool.query('UPDATE clubs SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Кружок не найден' });
  res.json(rows[0]);
});

router.get('/registrations', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year, r.phone, r.comment, r.status, r.created_at,
            c.id AS club_id, c.title AS club_title, o.full_name AS organizer_name,
            u.full_name AS parent_name, u.email AS parent_email
     FROM registrations r
     JOIN clubs c ON c.id = r.club_id
     JOIN users o ON o.id = c.organizer_id
     JOIN users u ON u.id = r.user_id
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC`);
  res.json(rows);
});

router.patch('/registrations/:id', async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Допустимо: confirmed или rejected' });
  const { rows } = await pool.query(
    `UPDATE registrations SET status = $1 WHERE id = $2 AND status = 'pending' RETURNING id, status`,
    [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
  notifyStatusChange(rows[0].id);
  res.json(rows[0]);
});

router.post('/categories', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Название слишком короткое' });
  try {
    const { rows } = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name', [name]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Такая категория уже есть' });
    throw e;
  }
});

router.put('/categories/:id', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Название слишком короткое' });
  try {
    const { rows } = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name', [name, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Категория не найдена' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Такая категория уже есть' });
    throw e;
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Категория не найдена' });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'Нельзя удалить: в категории есть кружки' });
    throw e;
  }
});

module.exports = router;
