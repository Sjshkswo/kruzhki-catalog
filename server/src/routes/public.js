const router = require('express').Router();
const pool = require('../db/pool');

// Общий SELECT: кружок + категория + организатор + число свободных мест
const CLUB_SELECT = `
  SELECT c.id, c.title, c.description, c.age_min, c.age_max, c.price, c.address, c.capacity,
         c.is_active, c.category_id, cat.name AS category_name, u.full_name AS organizer_name,
         u.phone AS organizer_phone, u.email AS organizer_email,
         c.capacity - (SELECT COUNT(*) FROM registrations r
                       WHERE r.club_id = c.id AND r.status IN ('pending','confirmed'))::int AS free_seats
  FROM clubs c
  JOIN categories cat ON cat.id = c.category_id
  JOIN users u ON u.id = c.organizer_id`;

router.get('/categories', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name');
  res.json(rows);
});

router.get('/clubs', async (req, res) => {
  const { search, category, age, free } = req.query;
  const where = ['c.is_active = TRUE'];
  const params = [];
  if (category) { params.push(Number(category)); where.push(`c.category_id = $${params.length}`); }
  if (age) { params.push(Number(age)); where.push(`c.age_min <= $${params.length} AND c.age_max >= $${params.length}`); }
  if (free === 'true') where.push('c.price = 0');
  const { rows } = await pool.query(`${CLUB_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC`, params);
  // Поиск по названию делаем в коде: так он одинаково работает с кириллицей
  // при любых настройках локали PostgreSQL
  const needle = (search || '').trim().toLowerCase();
  res.json(needle ? rows.filter((c) => c.title.toLowerCase().includes(needle)) : rows);
});

router.get('/clubs/:id', async (req, res) => {
  const { rows } = await pool.query(`${CLUB_SELECT} WHERE c.id = $1 AND c.is_active = TRUE`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Кружок не найден' });
  const sch = await pool.query(
    `SELECT id, weekday, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time
     FROM schedules WHERE club_id = $1 ORDER BY weekday, start_time`, [req.params.id]);
  res.json({ ...rows[0], schedule: sch.rows });
});

module.exports = router;
module.exports.CLUB_SELECT = CLUB_SELECT;
