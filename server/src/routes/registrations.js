const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { notifyNewRegistration } = require('../mailer');

router.use(auth);

// Подать заявку (только участник)
router.post('/', requireRole('participant'), async (req, res) => {
  const { club_id, participant_name, participant_birth_year, phone, comment } = req.body;
  const year = Number(participant_birth_year);
  const nowYear = new Date().getFullYear();
  if (!participant_name || participant_name.trim().length < 2) return res.status(400).json({ error: 'Укажите имя участника' });
  if (!(year >= nowYear - 100 && year <= nowYear)) return res.status(400).json({ error: 'Неверный год рождения' });
  if (!phone || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Укажите телефон' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Блокируем строку кружка, чтобы два человека не заняли последнее место одновременно
    const c = await client.query('SELECT id, capacity, is_active FROM clubs WHERE id = $1 FOR UPDATE', [club_id]);
    if (!c.rows[0] || !c.rows[0].is_active) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Кружок не найден' }); }
    const taken = await client.query(
      `SELECT COUNT(*)::int AS n FROM registrations WHERE club_id = $1 AND status IN ('pending','confirmed')`, [club_id]);
    if (taken.rows[0].n >= c.rows[0].capacity) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Свободных мест нет' }); }
    const r = await client.query(
      `INSERT INTO registrations (user_id, club_id, participant_name, participant_birth_year, phone, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [req.user.id, club_id, participant_name.trim(), year, phone, comment || null]);
    await client.query('COMMIT');
    notifyNewRegistration(r.rows[0].id); // письмо отправляется в фоне, не задерживая ответ
    res.status(201).json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Вы уже подали заявку для этого участника' });
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally { client.release(); }
});

router.get('/my', requireRole('participant'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year, r.status, r.created_at,
            c.id AS club_id, c.title AS club_title, c.address
     FROM registrations r JOIN clubs c ON c.id = r.club_id
     WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [req.user.id]);
  res.json(rows);
});

router.patch('/:id/cancel', requireRole('participant'), async (req, res) => {
  const r = await pool.query(
    `UPDATE registrations SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status IN ('pending','confirmed') RETURNING id, status`,
    [req.params.id, req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Заявка не найдена или уже закрыта' });
  res.json(r.rows[0]);
});

module.exports = router;
