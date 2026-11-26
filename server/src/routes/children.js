const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

// Персональные данные детей доступны только пользователю-владельцу профиля.
router.use(auth, requireRole('parent', 'organizer', 'admin'));

function validBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return false;
  }

  const minimumDate = new Date('1920-01-02T00:00:00.000Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return date >= minimumDate && date <= today;
}

function validName(value) {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 100;
}

function validGender(value) {
  return value === undefined || value === null || value === '' || value === 'male' || value === 'female';
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, full_name, birth_date, gender, created_at
     FROM children
     WHERE parent_id = $1
     ORDER BY created_at DESC, id DESC`,
    [req.user.id]
  );

  res.json(rows);
});

router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Профиль ребёнка не найден' });
  }

  const { rows } = await pool.query(
    `SELECT id, full_name, birth_date, gender, created_at
     FROM children
     WHERE id = $1 AND parent_id = $2`,
    [req.params.id, req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Профиль ребёнка не найден' });
  }

  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { full_name, birth_date, gender, consent } = req.body || {};

  if (!validName(full_name) || !validBirthDate(birth_date) || !validGender(gender) || consent !== true) {
    return res.status(400).json({
      error: 'Проверьте ФИО, дату рождения и пол. Подтвердите согласие на обработку персональных данных',
    });
  }

  const { rows } = await pool.query(
    `INSERT INTO children (parent_id, full_name, birth_date, gender, consent_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, full_name, birth_date, gender, created_at`,
    [req.user.id, full_name.trim(), birth_date, gender || null]
  );

  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Профиль ребёнка не найден' });
  }

  const { full_name, birth_date, gender } = req.body || {};
  if (!validName(full_name) || !validBirthDate(birth_date) || !validGender(gender)) {
    return res.status(400).json({ error: 'Проверьте ФИО, дату рождения и пол' });
  }

  const { rows } = await pool.query(
    `UPDATE children
     SET full_name = $1, birth_date = $2, gender = $3
     WHERE id = $4 AND parent_id = $5
     RETURNING id, full_name, birth_date, gender, created_at`,
    [full_name.trim(), birth_date, gender || null, req.params.id, req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Профиль ребёнка не найден' });
  }

  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Профиль ребёнка не найден' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const child = await client.query(
      `SELECT id
       FROM children
       WHERE id = $1 AND parent_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.id]
    );

    if (!child.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Профиль ребёнка не найден' });
    }

    const active = await client.query(
      `SELECT 1
       FROM registrations
       WHERE child_id = $1
         AND status IN ('waitlist', 'pending', 'confirmed')
       LIMIT 1`,
      [req.params.id]
    );

    if (active.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Нельзя удалить профиль: у ребёнка есть активные заявки' });
    }

    // Историю закрытых заявок сохраняем, отвязывая их от удаляемого профиля.
    await client.query(
      `UPDATE registrations
       SET child_id = NULL
       WHERE child_id = $1
         AND status NOT IN ('waitlist', 'pending', 'confirmed')`,
      [req.params.id]
    );

    await client.query('DELETE FROM children WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');

    res.json({ ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

module.exports = router;
