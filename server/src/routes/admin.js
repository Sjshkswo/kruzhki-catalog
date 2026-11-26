const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { notifyStatusChange } = require('../mailer');
const { logAdmin } = require('../db/adminLog');

router.use(auth, requireRole('admin'));

router.get('/users', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, phone, role, is_blocked, created_at FROM users ORDER BY id');
  res.json(rows);
});

router.patch('/users/:id/block', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Пользователь не найден' });
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
  const client = await pool.connect();
  let cancelledIds = [];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE users SET is_blocked = NOT is_blocked WHERE id = $1 AND role <> 'admin' RETURNING id, is_blocked, role`, [req.params.id]);
    const u = rows[0];
    if (!u) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Пользователь не найден' }); }
    // R-5: кружки заблокированного организатора скрываются из каталога (фильтр R-4),
    // а активные заявки на них отменяются со статусом cancelled_by_system
    if (u.is_blocked && u.role === 'organizer') {
      const c = await client.query(
        `UPDATE registrations SET status = 'cancelled_by_system'
         WHERE status IN ('pending','confirmed') AND club_id IN (SELECT id FROM clubs WHERE organizer_id = $1)
         RETURNING id`, [u.id]);
      cancelledIds = c.rows.map((x) => x.id);
    }
    await logAdmin(req.user.id, u.is_blocked ? 'user_blocked' : 'user_unblocked', 'user', u.id, { cancelled_registrations: cancelledIds.length }, client);
    await client.query('COMMIT');
    cancelledIds.forEach((id) => notifyStatusChange(id)); // письма родителям в фоне
    res.json({ id: u.id, is_blocked: u.is_blocked, cancelled_registrations: cancelledIds.length });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
});

router.get('/clubs', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.is_active, c.moderation_status, c.moderation_comment,
            u.full_name AS organizer_name, u.is_blocked AS organizer_blocked, cat.name AS category_name
     FROM clubs c JOIN users u ON u.id = c.organizer_id JOIN categories cat ON cat.id = c.category_id
     ORDER BY (c.moderation_status = 'pending_review') DESC, c.id`);
  res.json(rows);
});

// R-3: moderation_status меняет только админ, и обязательно с причиной при отказе и блокировке
router.patch('/clubs/:id/moderation', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Кружок не найден' });
  const { status, comment } = req.body;
  if (!['approved', 'rejected', 'blocked'].includes(status)) return res.status(400).json({ error: 'Допустимо: approved, rejected или blocked' });
  if (status !== 'approved' && (typeof comment !== 'string' || comment.trim().length < 3))
    return res.status(400).json({ error: 'Укажите причину (не короче 3 символов)' });
  const { rows } = await pool.query(
    `UPDATE clubs SET moderation_status = $1, moderation_comment = $2 WHERE id = $3 RETURNING id, moderation_status, moderation_comment`,
    [status, status === 'approved' ? null : comment.trim(), req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Кружок не найден' });
  await logAdmin(req.user.id, `club_${status}`, 'club', rows[0].id, { comment: comment || null });
  res.json(rows[0]);
});

// Очередь на проверке: заявки организаторов и кружки
router.get('/moderation', async (req, res) => {
  const apps = await pool.query(
    `SELECT a.id, a.org_name, a.bin, a.phone, a.social_url, a.created_at, u.full_name, u.email
     FROM organizer_applications a JOIN users u ON u.id = a.user_id WHERE a.status = 'pending' ORDER BY a.created_at`);
  const clubs = await pool.query(
    `SELECT c.id, c.title, u.full_name AS organizer_name FROM clubs c JOIN users u ON u.id = c.organizer_id
     WHERE c.moderation_status = 'pending_review' ORDER BY c.created_at`);
  res.json({ applications: apps.rows, clubs: clubs.rows });
});

router.get('/organizer-applications', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.org_name, a.bin, a.phone, a.social_url, a.status, a.admin_comment, a.created_at,
            u.id AS user_id, u.full_name, u.email
     FROM organizer_applications a JOIN users u ON u.id = a.user_id
     ORDER BY (a.status = 'pending') DESC, a.created_at DESC`);
  res.json(rows);
});

// R-1: админ одобряет заявку (пользователь становится организатором) или отклоняет с причиной
router.patch('/organizer-applications/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
  const { status, comment } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Допустимо: approved или rejected' });
  if (status === 'rejected' && (typeof comment !== 'string' || comment.trim().length < 3))
    return res.status(400).json({ error: 'Укажите причину отказа (не короче 3 символов)' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE organizer_applications SET status = $1, admin_comment = $2
       WHERE id = $3 AND status = 'pending' RETURNING id, user_id, status`,
      [status, typeof comment === 'string' && comment.trim() ? comment.trim() : null, req.params.id]);
    if (!r.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Заявка не найдена или уже обработана' }); }
    if (status === 'approved') await client.query(`UPDATE users SET role = 'organizer' WHERE id = $1 AND role = 'parent'`, [r.rows[0].user_id]);
    await logAdmin(req.user.id, `organizer_application_${status}`, 'user', r.rows[0].user_id, { comment: comment || null }, client);
    await client.query('COMMIT');
    res.json({ id: r.rows[0].id, status: r.rows[0].status });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
});

router.get('/log', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.full_name AS admin_name
     FROM admin_log l JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT 200`);
  res.json(rows);
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
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
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
