const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { notifyNewRegistration } = require('../mailer');
const { ageFits, approxAge } = require('../utils/age');
const { serverError } = require('../utils/errors');

router.use(auth);

// Записывать детей могут родитель, организатор (но не в свой кружок) и админ (R-18)
const CAN_REGISTER = requireRole('parent', 'organizer', 'admin');

router.post('/', CAN_REGISTER, async (req, res) => {
  const { club_id, participant_name, participant_birth_year, phone, comment } = req.body;
  const clubId = Number(club_id);
  const year = Number(participant_birth_year);
  const nowYear = new Date().getFullYear();
  if (!Number.isInteger(clubId) || clubId <= 0) return res.status(400).json({ error: 'Неверный номер кружка' });
  if (typeof participant_name !== 'string' || participant_name.trim().length < 2) return res.status(400).json({ error: 'Укажите имя участника' });
  if (!Number.isInteger(year) || !(year >= nowYear - 100 && year <= nowYear)) return res.status(400).json({ error: 'Неверный год рождения' });
  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Укажите телефон' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Блокируем строку кружка, чтобы два человека не заняли последнее место одновременно
    const c = await client.query(
      `SELECT c.id, c.capacity, c.is_active, c.moderation_status, c.age_min, c.age_max, c.organizer_id,
              o.is_blocked AS organizer_blocked
       FROM clubs c JOIN users o ON o.id = c.organizer_id
       WHERE c.id = $1 FOR UPDATE OF c`, [clubId]);
    const club = c.rows[0];
    // R-4: записаться можно только в кружок, который виден в каталоге
    if (!club || !club.is_active || club.moderation_status !== 'approved' || club.organizer_blocked) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Кружок не найден' });
    }
    if (club.organizer_id === req.user.id) { // R-18
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Нельзя записываться в свой собственный кружок' });
    }
    // R-10: возраст ребёнка должен подходить кружку
    if (!ageFits(year, club.age_min, club.age_max, nowYear)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Возраст не подходит: кружок для детей ${club.age_min}–${club.age_max} лет, вашему ребёнку около ${approxAge(year, nowYear)}`,
      });
    }
    const taken = await client.query(
      `SELECT COUNT(*)::int AS n FROM registrations WHERE club_id = $1 AND status IN ('pending','confirmed')`, [clubId]);
    if (taken.rows[0].n >= club.capacity) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Свободных мест нет' }); }
    const r = await client.query(
      `INSERT INTO registrations (user_id, club_id, participant_name, participant_birth_year, phone, comment)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [req.user.id, clubId, participant_name.trim(), year, phone, typeof comment === 'string' ? comment : null]);
    await client.query('COMMIT');
    notifyNewRegistration(r.rows[0].id); // письмо отправляется в фоне, не задерживая ответ
    res.status(201).json(r.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Вы уже подали заявку для этого участника' });
    serverError(res, e);
  } finally { client.release(); }
});

router.get('/my', CAN_REGISTER, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year, r.status, r.created_at,
            c.id AS club_id, c.title AS club_title, c.address
     FROM registrations r JOIN clubs c ON c.id = r.club_id
     WHERE r.user_id = $1 ORDER BY r.created_at DESC`, [req.user.id]);
  res.json(rows);
});

router.patch('/:id/cancel', CAN_REGISTER, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Заявка не найдена или уже закрыта' });
  const r = await pool.query(
    `UPDATE registrations SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status IN ('pending','confirmed') RETURNING id, status`,
    [req.params.id, req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Заявка не найдена или уже закрыта' });
  res.json(r.rows[0]);
});

module.exports = router;
