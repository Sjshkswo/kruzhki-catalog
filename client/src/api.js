// Обёртка над fetch: добавляет токен и разбирает ошибки
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Нет связи с сервером. Проверьте, что сервер запущен (папка server, команда npm start).');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (data && data.error) throw new Error(data.error);
    throw new Error('Сервер не отвечает. Запустите его: в папке server выполните npm start и не закрывайте терминал.');
  }
  return data || {};
}

// Цвет и значок для каждой категории (подбираются по названию)
const CATEGORY_STYLES = [
  { key: 'спорт', emoji: '⚽', from: '#22c55e', to: '#16a34a' },
  { key: 'музык', emoji: '🎵', from: '#ec4899', to: '#be185d' },
  { key: 'программ', emoji: '💻', from: '#3b82f6', to: '#1d4ed8' },
  { key: 'рисован', emoji: '🎨', from: '#f59e0b', to: '#d97706' },
  { key: 'танц', emoji: '💃', from: '#a855f7', to: '#7e22ce' },
  { key: 'язык', emoji: '🌍', from: '#14b8a6', to: '#0f766e' },
  { key: 'шахмат', emoji: '♟️', from: '#64748b', to: '#334155' },
];
export function categoryStyle(name = '') {
  const n = name.toLowerCase();
  const found = CATEGORY_STYLES.find((c) => n.includes(c.key));
  return found || { emoji: '🎯', from: '#6366f1', to: '#4338ca' };
}
export const bannerBg = (name) => {
  const c = categoryStyle(name);
  return { background: `linear-gradient(135deg, ${c.from}, ${c.to})` };
};

export const WEEKDAYS = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const STATUS_LABELS = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
};
export const formatPrice = (p) => (Number(p) === 0 ? 'Бесплатно' : `${Number(p).toLocaleString('ru-RU')} ₸/мес`);
