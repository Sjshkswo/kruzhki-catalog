// Автоматическая проверка API: node test/api.test.js  (или npm test)
// ВАЖНО: перед запуском выполните npm run db:init и npm run db:seed (чистая база),
// сервер должен работать (npm start). Тест создаёт заявки и блокирует пользователя,
// поэтому после него снова выполните db:init и db:seed, чтобы вернуть демо-данные.
const BASE = process.env.API || 'http://localhost:4000/api';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token;

let passed = 0, failed = 0, n = 0;
function check(name, ok, details = '') {
  n++;
  if (ok) { passed++; console.log(`  ✓ ${n}. ${name}`); }
  else { failed++; console.log(`  ✗ ${n}. ${name}  ${details}`); }
}

(async () => {
  console.log('Проверка API:', BASE);
  const user = await login('user@kruzhki.local', 'user1234');
  const org1 = await login('organizer@kruzhki.local', 'org12345');
  const org2 = await login('organizer2@kruzhki.local', 'org12345');
  const admin = await login('admin@kruzhki.local', 'admin123');
  if (!user || !org1 || !org2 || !admin) { console.log('Не удалось войти демо-пользователями. Выполните db:init и db:seed.'); process.exit(1); }

  let r = await call('GET', '/clubs');
  check('Каталог возвращает 8 активных кружков', r.data.length === 8, `получено ${r.data.length}`);

  r = await call('GET', '/clubs?free=true');
  check('Фильтр «Бесплатные» оставляет только кружки с ценой 0', r.data.length === 2 && r.data.every((c) => Number(c.price) === 0));

  r = await call('GET', '/clubs?age=5');
  check('Фильтр по возрасту 5 лет', r.data.length >= 1 && r.data.every((c) => c.age_min <= 5 && c.age_max >= 5));

  r = await call('GET', `/clubs?search=${encodeURIComponent('ГИТАР')}`);
  check('Поиск «ГИТАР» (любой регистр) находит «Гитара с нуля»', r.data.some((c) => c.title === 'Гитара с нуля'));

  r = await call('GET', '/clubs/1');
  check('Карточка кружка: расписание и свободные места', r.status === 200 && r.data.schedule.length === 2 && r.data.free_seats === 20);

  const reg = { club_id: 8, participant_name: 'Саша', participant_birth_year: 2019, phone: '+77001234567' };
  r = await call('POST', '/registrations', reg, user);
  const regId = r.data.id;
  check('Запись участника: код 201, статус «ожидает»', r.status === 201 && r.data.status === 'pending');

  r = await call('POST', '/registrations', reg, user);
  check('Повторная заявка на того же участника: код 409', r.status === 409);

  r = await call('POST', '/registrations', reg, org1);
  check('Организатор пытается записаться: код 403', r.status === 403);

  r = await call('PATCH', `/organizer/registrations/${regId}`, { status: 'confirmed' }, org1);
  check('Чужой организатор подтверждает заявку: код 404', r.status === 404);

  r = await call('PATCH', `/organizer/registrations/${regId}`, { status: 'confirmed' }, org2);
  check('Организатор-владелец подтверждает заявку: код 200, «подтверждена»', r.status === 200 && r.data.status === 'confirmed');

  r = await call('PATCH', `/registrations/${regId}/cancel`, null, user);
  const cancelOk = r.status === 200;
  r = await call('POST', '/registrations', reg, user);
  check('Отмена заявки и повторная запись после отмены', cancelOk && r.status === 201);

  const codes = [];
  for (let i = 1; i <= 6; i++) {
    codes.push((await call('POST', '/registrations', { ...reg, participant_name: `Ребёнок${i}` }, user)).status);
  }
  check('Заявки сверх вместимости (6 мест): последняя отклонена, код 409', codes.slice(0, 5).every((c) => c === 201) && codes[5] === 409, JSON.stringify(codes));

  const club = { title: 'Шахматы', category_id: 1, age_min: 6, age_max: 12, price: 0, capacity: 10, schedule: [{ weekday: 2, start_time: '15:00', end_time: '16:00' }] };
  r = await call('POST', '/organizer/clubs', club, org1);
  check('Создание кружка с расписанием: код 201', r.status === 201);

  r = await call('POST', '/organizer/clubs', { ...club, schedule: [{ weekday: 2, start_time: '17:00', end_time: '16:00' }] }, org1);
  check('Расписание, где конец раньше начала: код 400', r.status === 400);

  r = await call('GET', '/admin/users', null, user);
  check('Участник обращается к админ-маршруту: код 403', r.status === 403);

  r = await call('PATCH', '/admin/users/4/block', null, admin);
  const blocked = r.status === 200 && r.data.is_blocked === true;
  const l = await call('POST', '/auth/login', { email: 'user@kruzhki.local', password: 'user1234' });
  const old = await call('GET', '/registrations/my', null, user);
  check('Блокировка: вход и старый токен дают код 403', blocked && l.status === 403 && old.status === 403);

  r = await call('POST', '/auth/register', { full_name: 'Тест Админ', email: `t${Date.now()}@test.kz`, password: '123456', role: 'admin' });
  check('Регистрация с role = admin создаёт роль participant', r.status === 201 && r.data.user.role === 'participant');

  r = await call('DELETE', '/admin/categories/1', null, admin);
  check('Удаление категории, в которой есть кружки: код 409', r.status === 409);

  r = await call('PUT', '/profile', { full_name: 'Анна Новая', phone: '+77001112233' }, org1);
  check('Изменение профиля: код 200', r.status === 200 && r.data.user.full_name === 'Анна Новая');

  r = await call('GET', '/admin/registrations', null, admin);
  const pending = (r.data || []).find((x) => x.status === 'pending');
  const r2 = pending ? await call('PATCH', `/admin/registrations/${pending.id}`, { status: 'rejected' }, admin) : { status: 0 };
  check('Админ видит все заявки и может обработать заявку', r.status === 200 && r.data.length > 0 && r2.status === 200);

  console.log(`\nИтог: пройдено ${passed} из ${n}` + (failed ? `, провалено ${failed}` : ''));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Ошибка теста:', e.message); process.exit(1); });
