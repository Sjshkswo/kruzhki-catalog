const router = require('express').Router();
const pool = require('../db/pool');
const { auth, requireRole } = require('../middleware/auth');

router.put('/', auth, async (req, res) => {
  const { full_name, phone } = req.body;
  if (typeof full_name !== 'string' || full_name.trim().length < 2) return res.status(400).json({ error: 'Укажите ФИО' });
  const { rows } = await pool.query(
    'UPDATE users SET full_name = $1, phone = $2 WHERE id = $3 RETURNING id, full_name, email, phone, role',
    [full_name.trim(), phone || null, req.user.id]);
  res.json({ user: rows[0] });
});

// R-1: стать организатором можно только через заявку, которую одобряет администратор
router.post('/organizer-application', auth, requireRole('parent'), async (req, res) => {
  const { org_name, bin, phone, social_url } = req.body;
  if (typeof org_name !== 'string' || org_name.trim().length < 2) return res.status(400).json({ error: 'Укажите название организации' });
  if (typeof bin !== 'string' || !/^\d{12}$/.test(bin.trim())) return res.status(400).json({ error: 'БИН/ИИН должен состоять из 12 цифр' });
  if (typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Укажите телефон' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO organizer_applications (user_id, org_name, bin, phone, social_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, status`,
      [req.user.id, org_name.trim(), bin.trim(), phone, typeof social_url === 'string' && social_url.trim() ? social_url.trim() : null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ваша заявка уже на рассмотрении' });
    throw e;
  }
});

// Последняя заявка текущего пользователя (чтобы показать статус и причину отказа)
router.get('/organizer-application', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, org_name, status, admin_comment, created_at FROM organizer_applications
     WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, [req.user.id]);
  res.json(rows[0] || null);
});

module.exports = router;
