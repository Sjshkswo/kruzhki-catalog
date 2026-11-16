const router = require('express').Router();
const pool = require('../db/pool');
const { auth } = require('../middleware/auth');

router.put('/', auth, async (req, res) => {
  const { full_name, phone } = req.body;
  if (!full_name || full_name.trim().length < 2) return res.status(400).json({ error: 'Укажите ФИО' });
  const { rows } = await pool.query(
    'UPDATE users SET full_name = $1, phone = $2 WHERE id = $3 RETURNING id, full_name, email, phone, role',
    [full_name.trim(), phone || null, req.user.id]);
  res.json({ user: rows[0] });
});

module.exports = router;
