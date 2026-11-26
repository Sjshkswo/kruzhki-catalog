// Журнал действий администратора (блокировки, модерация, роли)
const pool = require('./pool');

async function logAdmin(adminId, action, targetType, targetId, details = null, db = pool) {
  await db.query(
    'INSERT INTO admin_log (admin_id, action, target_type, target_id, details) VALUES ($1,$2,$3,$4,$5)',
    [adminId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}
module.exports = { logAdmin };
