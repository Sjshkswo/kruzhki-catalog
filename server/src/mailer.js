// Отправка писем: организатору – о новой записи в его кружок, родителю – о статусе заявки.
// Организатору письмо идёт на email из его аккаунта; если там демо-адрес (.local),
// используется NOTIFY_EMAIL (запасной адрес).
// Если почта не настроена (нет MAIL_USER/MAIL_PASS), письма пропускаются и сайт работает как обычно.
// MAIL_MODE=console – режим проверки: письма не отправляются, а печатаются в терминале сервера.
require('dotenv').config();
const nodemailer = require('nodemailer');
const pool = require('./db/pool');

// Куда приходят уведомления о заявках (по умолчанию – почта владельца проекта)
const OWNER = () => process.env.NOTIFY_EMAIL || process.env.MAIL_USER || 'tepmuhatop338@gmail.com';
const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

let transporter = null;
function getTransport() {
  if (transporter) return transporter;
  if (process.env.MAIL_MODE === 'console') {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  } else if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS.replace(/\s/g, '') },
    });
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const realEmail = (e) => e && !e.endsWith('.local'); // демо-адреса .local не существуют

// Кому писать организатору: его собственный email, а для демо-аккаунтов (.local) – запасной NOTIFY_EMAIL
const organizerTo = (r) => (realEmail(r.organizer_email) ? r.organizer_email : OWNER());

async function send(message) {
  const tr = getTransport();
  if (!tr) { console.log('[почта] не настроена (MAIL_USER / MAIL_PASS), письмо пропущено:', message.subject); return; }
  await tr.sendMail({ from: `"Каталог кружков" <${process.env.MAIL_USER || 'noreply@kruzhki.local'}>`, ...message });
  console.log(`[почта${process.env.MAIL_MODE === 'console' ? ':тест' : ''}] ${message.to} | ${message.subject}`);
}

async function load(id) {
  const { rows } = await pool.query(
    `SELECT r.id, r.participant_name, r.participant_birth_year, r.phone, r.comment, r.status, r.created_at,
            c.title AS club_title, c.address, o.full_name AS organizer_name, o.email AS organizer_email,
            u.full_name AS parent_name, u.email AS parent_email
     FROM registrations r
     JOIN clubs c ON c.id = r.club_id
     JOIN users o ON o.id = c.organizer_id
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1`, [id]);
  return rows[0];
}

const row = (k, v) => `<tr><td style="padding:6px 12px;color:#6b7280">${k}</td><td style="padding:6px 12px"><b>${esc(v) || '—'}</b></td></tr>`;

// Новая запись в кружок: письмо ОРГАНИЗАТОРУ этого кружка + подтверждение получения родителю
async function notifyNewRegistration(id) {
  try {
    const r = await load(id);
    if (!r) return;
    const to = organizerTo(r);
    if (to) {
      await send({
        to,
        replyTo: realEmail(r.parent_email) ? r.parent_email : undefined,
        subject: `К вам записались: ${r.participant_name} → ${r.club_title}`,
        html: `<h2 style="margin:0 0 8px">🎯 Новая запись в ваш кружок «${esc(r.club_title)}»</h2>
          <p style="margin:0 0 12px">Здравствуйте, ${esc(r.organizer_name)}! В ваш кружок записался участник.</p>
          <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:15px">
            ${row('Ребёнок', r.participant_name)}${row('Год рождения', r.participant_birth_year)}
            ${row('Кружок', r.club_title)}
            ${row('Родитель', r.parent_name)}${row('Email родителя', r.parent_email)}
            ${row('Телефон', r.phone)}${row('Комментарий', r.comment)}
          </table>
          <p><a href="${CLIENT_URL()}/organizer/registrations">Открыть заявки и подтвердить или отклонить запись</a></p>`,
      });
    }
    if (realEmail(r.parent_email)) {
      await send({
        to: r.parent_email, replyTo: realEmail(r.organizer_email) ? r.organizer_email : OWNER(),
        subject: `Заявка принята: ${r.club_title}`,
        html: `<p>Здравствуйте, ${esc(r.parent_name)}!</p>
          <p>Мы получили заявку на запись <b>${esc(r.participant_name)}</b> в кружок «${esc(r.club_title)}». Организатор ${esc(r.organizer_name)} свяжется с вами, статус можно смотреть в личном кабинете.</p>`,
      });
    }
  } catch (e) { console.error('[почта] ошибка:', e.message); }
}

// Организатор или админ ответил на заявку: письмо родителю
async function notifyStatusChange(id) {
  try {
    const r = await load(id);
    if (!r || !realEmail(r.parent_email)) return;
    const ok = r.status === 'confirmed';
    await send({
      to: r.parent_email, replyTo: realEmail(r.organizer_email) ? r.organizer_email : OWNER(),
      subject: `${ok ? 'Заявка подтверждена' : 'Заявка отклонена'}: ${r.club_title}`,
      html: `<p>Здравствуйте, ${esc(r.parent_name)}!</p>
        <p>Заявка на запись <b>${esc(r.participant_name)}</b> в кружок «${esc(r.club_title)}» <b>${ok ? 'подтверждена ✅' : 'отклонена'}</b>.</p>
        ${ok && r.address ? `<p>Адрес: ${esc(r.address)}</p>` : ''}`,
    });
  } catch (e) { console.error('[почта] ошибка:', e.message); }
}

module.exports = { notifyNewRegistration, notifyStatusChange };
