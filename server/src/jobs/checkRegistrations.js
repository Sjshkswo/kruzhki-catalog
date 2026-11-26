const pool = require('../db/pool');
const { addNotification } = require('../services/notifications');

async function runRegistrationChecks() {
  try {
    // Напоминание организатору и родителю через 5 дней, чтобы решение не тянулось.
    const fiveDaysQ = await pool.query(`
      SELECT r.id,r.club_id,r.user_id,c.title
      FROM registrations r
      JOIN clubs c ON c.id=r.club_id
      WHERE r.status='pending'
        AND r.created_at <= now()-interval '5 days'
        AND r.created_at > now()-interval '6 days'
    `);
    for (const r of fiveDaysQ.rows) {
      await addNotification(pool, {
        userId: r.user_id,
        type: 'registration_reminder',
        title: 'Заявка ещё рассматривается',
        message: `Заявка в «${r.title}» находится на рассмотрении уже 5 дней.`,
        link: '/my-registrations',
        dedupKey: `registration:${r.id}:pending-5d`,
      });
    }

    // Истечение заявок pending > 10 дней -> status = 'expired' (R-14)
    const tenDaysQ = await pool.query(`
      SELECT r.id, r.club_id, r.user_id, c.title
      FROM registrations r
      JOIN clubs c ON c.id = r.club_id
      WHERE r.status = 'pending'
        AND r.created_at <= now() - interval '10 days'
    `);

    for (const r of tenDaysQ.rows) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("UPDATE registrations SET status = 'expired', decided_at = now() WHERE id = $1", [r.id]);
        await client.query(
          "INSERT INTO registration_history(registration_id, from_status, to_status, reason) VALUES($1, 'pending', 'expired', 'Истёк срок ожидания решения (10 дней)')",
          [r.id]
        );
        await addNotification(client,{userId:r.user_id,type:'registration_expired',title:'Срок заявки истёк',message:`Заявка в «${r.title}» автоматически закрыта через 10 дней без решения организатора.`,link:'/my-registrations',dedupKey:`registration:${r.id}:expired`});

        // Освободилось место -> продвигаем первого из waitlist
        const next = await client.query(
          "SELECT id FROM registrations WHERE club_id = $1 AND status = 'waitlist' ORDER BY waitlist_position, id LIMIT 1 FOR UPDATE",
          [r.club_id]
        );
        if (next.rows[0]) {
          await client.query("UPDATE registrations SET status = 'pending', waitlist_position = NULL WHERE id = $1", [next.rows[0].id]);
          await client.query(
            "INSERT INTO registration_history(registration_id, from_status, to_status, reason) VALUES($1, 'waitlist', 'pending', 'Продвижение из очереди ожидания')",
            [next.rows[0].id]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[job] Ошибка обработки expired для заявки ${r.id}:`, err.message);
      } finally {
        client.release();
      }
    }
  } catch (e) {
    console.error('[job] Ошибка выполнения фоновой задачи заявок:', e.message);
  }
}

module.exports = { runRegistrationChecks };
