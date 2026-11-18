async function addNotification(db, notification) {
  await db.query(
    `INSERT INTO notifications(user_id,type,title,message,link,dedup_key)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING`,
    [
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.link || null,
      notification.dedupKey || null,
    ]
  );
}

module.exports = { addNotification };

