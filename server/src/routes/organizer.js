const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');
const { CLUB_SELECT } = require('./public');
const { notifyStatusChange } = require('../mailer');

router.use(auth, requireRole('organizer'));

// Проверка полей кружка; возвращает текст ошибки или null
function validateClub(b) {
  if (!b.title || b.title.trim().length < 3) return 'Название — минимум 3 символа';
  if (!Number(b.category_id)) return 'Выберите категорию';
  const amin = Number(b.age_min), amax = Number(b.age_max);
  if (!(amin >= 0) || !(amax >= amin)) return 'Проверьте возрастные границы';
  if (!(Number(b.price) >= 0)) return 'Цена не может быть отрицательной';
  if (!(Number(b.capacity) > 0)) return 'Число мест должно быть больше нуля';
  for (const s of b.schedule || []) {
    if (!(s.weekday >= 1 && s.weekday <= 7) || !s.start_time || !s.end_time || s.end_time <= s.start_time)
      return 'Проверьте расписание: время окончания должно быть позже начала';
  }
  return null;
}

async function saveSchedule(client, clubId, schedule = []) {
  await client.query('DELETE FROM schedules WHERE club_id = $1', [clubId]);
  for (const s of schedule) {
    await client.query(
      'INSERT INTO schedules (club_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)',
      [clubId, s.weekday, s.start_time, s.end_time]
    );
  }
}

router.get('/clubs', async (req, res) => {
  const { rows } = await pool.query(`${CLUB_SELECT} WHERE c.organizer_id = $1 ORDER BY c.created_at DESC`, [req.user.id]);
  res.json(rows);
});

router.get('/clubs/:id', async (req, res) => {
  const { rows } = await pool.query(`${CLUB_SELECT} WHERE c.id = $1 AND c.organizer_id = $2`, [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Кружок не найден' });
  const sch = await pool.query(
    `SELECT weekday, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
     FROM schedules WHERE club_id = $1 ORDER BY weekday, start_time`, [req.params.id]);
  res.json({ ...rows[0], schedule: sch.rows });
});

router.post('/clubs', async (req, res) => {
  const err = validateClub(req.body);
  if (err) return res.status(400).json({ error: err });
  const b = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO clubs (organizer_id, category_id, title, description, age_min, age_max, price, address, capacity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.id, b.category_id, b.title.trim(), b.description || '', b.age_min, b.age_max, b.price, b.address || '', b.capacity]
    );
    await saveSchedule(client, rows[0].id, b.schedule);
    await client.query('COMMIT');
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally { client.release(); }
});

router.put('/clubs/:id', async (req, res) => {
  const err = validateClub(req.body);
  if (err) return res.status(400).json({ error: err });
  const b = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE clubs SET category_id=$1, title=$2, description=$3, age_min=$4, age_max=$5,
              price=$6, address=$7, capacity=$8, is_active=COALESCE($9, is_active)
       WHERE id=$10 AND organizer_id=$11 RETURNING id`,
      [b.category_id, b.title.trim(), b.description || '', b.age_min, b.age_max, b.price, b.address || '',
       b.capacity, typeof b.is_active === 'boolean' ? b.is_active : null, req.params.id, req.user.id]
    );
    if (!r.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Кружок не найден' }); }
    await saveSchedule(client, req.params.id, b.schedule);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally { client.release(); }
});

// «Удаление» = скрытие кружка из каталога (заявки сохраняются)
router.delete('/clubs/:id', async (req, res) => {
  const r = await pool.query('UPDATE clubs SET is_active = FALSE WHERE id=$1 AND organizer_id=$2 RETURNING id', [req.params.id, req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Кружок не найден' });
  res.json({ ok: true });
});

router.get('/registrations', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year, r.phone, r.comment, r.status, r.created_at,
            c.id AS club_id, c.title AS club_title, u.full_name AS parent_name, u.email AS user_email
     FROM registrations r
     JOIN clubs c ON c.id = r.club_id
     JOIN users u ON u.id = r.user_id
     WHERE c.organizer_id = $1
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC`, [req.user.id]);
  res.json(rows);
});

router.patch('/registrations/:id', async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'rejected'].includes(status)) return res.status(400).json({ error: 'Допустимо: confirmed или rejected' });
  const r = await pool.query(
    `UPDATE registrations r SET status = $1
     FROM clubs c
     WHERE r.id = $2 AND c.id = r.club_id AND c.organizer_id = $3 AND r.status = 'pending'
     RETURNING r.id, r.status`, [status, req.params.id, req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Заявка не найдена или уже обработана' });
  notifyStatusChange(r.rows[0].id);
  res.json(r.rows[0]);
});

module.exports = router;
