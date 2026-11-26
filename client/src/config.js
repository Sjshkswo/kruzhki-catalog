// Контакты сайта. Номер WhatsApp задаётся в файле client/.env (см. .env.example)
export const WHATSAPP_PHONE = (import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/\D/g, '');
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || ''; // задаётся в client/.env

// Ссылка, которая открывает чат с владельцем сайта и подставляет текст сообщения.
// Если номер ещё не задан, ссылка ведёт на WhatsApp Web (чат при этом не открывается).
export const waLink = (text = 'Здравствуйте! Хочу уточнить информацию о кружках.') =>
  WHATSAPP_PHONE
    ? `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
    : 'https://web.whatsapp.com/';
