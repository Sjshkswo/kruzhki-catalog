const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { notifyNewRegistration } = require('../mailer');
const { ageAtDate } = require('../utils/age');
const { serverError } = require('../utils/errors');

router.use(auth);

// Каждый пользователь записывает только ребёнка из собственного профиля.
const CAN_REGISTER = requireRole('parent', 'organizer', 'admin');

router.post('/', CAN_REGISTER, async (req, res) => {
  const { club_id, child_id, phone, comment } = req.body || {};
  const clubId = Number(club_id);
  const childId = Number(child_id);

  if (!Number.isInteger(clubId) || clubId <= 0) {
    return res.status(400).json({ error: 'Неверный номер кружка' });
  }

  if (!Number.isInteger(childId) || childId <= 0) {
    return res.status(400).json({
      error: 'Выберите ребёнка из раздела «Мои дети»',
    });
  }

  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Укажите телефон' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const clubResult = await client.query(
      `SELECT c.id, c.capacity, c.is_active, c.moderation_status,
              c.age_min, c.age_max, c.organizer_id, c.season_start,
              o.is_blocked AS organizer_blocked
       FROM clubs c
       JOIN users o ON o.id = c.organizer_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [clubId]
    );

    const club = clubResult.rows[0];

    if (
      !club ||
      !club.is_active ||
      club.moderation_status !== 'approved' ||
      club.organizer_blocked
    ) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Кружок не найден' });
    }

    if (club.organizer_id === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Нельзя записываться в свой собственный кружок',
      });
    }

    // Получаем дату рождения и год рождения непосредственно из PostgreSQL.
    const childResult = await client.query(
      `SELECT
         id,
         full_name,
         TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date_iso,
         EXTRACT(YEAR FROM birth_date)::int AS birth_year
       FROM children
       WHERE id = $1 AND parent_id = $2`,
      [childId, req.user.id]
    );

    const child = childResult.rows[0];

    if (!child) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Выбранный профиль ребёнка не найден',
      });
    }

    const birthYear = Number(child.birth_year);

    if (
      !child.birth_date_iso ||
      !Number.isInteger(birthYear) ||
      birthYear < 1900
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Не удалось определить дату рождения ребёнка',
      });
    }

    const referenceDate = club.season_start || new Date();
    const age = ageAtDate(child.birth_date_iso, referenceDate);

    if (!Number.isFinite(age)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Не удалось определить возраст ребёнка',
      });
    }

    if (age < club.age_min || age > club.age_max) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Кружок для детей ${club.age_min}–${club.age_max} лет, вашему ребёнку ${age}`,
      });
    }

    const capacityResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM registrations
       WHERE club_id = $1 AND status IN ('pending', 'confirmed')`,
      [clubId]
    );

    if (capacityResult.rows[0].count >= club.capacity) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Свободных мест нет',
      });
    }

    // Используем проверенный год рождения из PostgreSQL.
    const registrationResult = await client.query(
      `INSERT INTO registrations
       (user_id, club_id, child_id, participant_name,
        participant_birth_year, phone, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, status, child_id`,
      [
        req.user.id,
        clubId,
        child.id,
        child.full_name,
        birthYear,
        phone,
        typeof comment === 'string' ? comment.trim() : null,
      ]
    );

    await client.query('COMMIT');

    notifyNewRegistration(registrationResult.rows[0].id);

    return res.status(201).json(registrationResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Вы уже подали заявку для этого ребёнка',
      });
    }

    return serverError(res, error);
  } finally {
    client.release();
  }
});

router.get('/my', CAN_REGISTER, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year,
            r.status, r.created_at, c.id AS club_id,
            c.title AS club_title, c.address
     FROM registrations r
     JOIN clubs c ON c.id = r.club_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC`,
    [req.user.id]
  );

  res.json(rows);
});

router.patch('/:id/cancel', CAN_REGISTER, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({
      error: 'Заявка не найдена или уже закрыта',
    });
  }

  const result = await pool.query(
    `UPDATE registrations
     SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2
       AND status IN ('pending', 'confirmed')
     RETURNING id, status`,
    [req.params.id, req.user.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({
      error: 'Заявка не найдена или уже закрыта',
    });
  }

  res.json(result.rows[0]);
});

module.exports = router;