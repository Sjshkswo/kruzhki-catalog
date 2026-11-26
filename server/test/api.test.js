// Автоматическая проверка API: npm test
// ВАЖНО: перед запуском выполните npm run db:reset и npm run db:seed (чистая база),
// сервер должен работать (npm start). Тест создаёт заявки, кружки и блокирует пользователей,
// поэтому после него снова выполните db:reset и db:seed, чтобы вернуть демо-данные.
// Не запускайте на рабочей базе!
const BASE = process.env.API || 'http://localhost:4000/api';

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const login = async (email, password) => (await call('POST', '/auth/login', { email, password })).data.token;

async function createChild(token, fullName, birthDate) {
  return call('POST', '/children', {
    full_name: fullName,
    birth_date: birthDate,
    gender: '',
    consent: true,
  }, token);
}

let passed = 0, failed = 0, n = 0;
function check(name, ok, details = '') {
  n++;
  if (ok) { passed++; console.log(`  ✓ ${n}. ${name}`); }
  else { failed++; console.log(`  ✗ ${n}. ${name}  ${details}`); }
}

(async () => {
  console.log('Проверка API:', BASE);
  const user = await login('user@kruzhki.local', 'user1234');          // родитель
  const org1 = await login('organizer@kruzhki.local', 'org12345');     // владелец кружков 1-4
  const org2 = await login('organizer2@kruzhki.local', 'org12345');    // владелец кружков 5-8
  const admin = await login('admin@kruzhki.local', 'admin123');
  if (!user || !org1 || !org2 || !admin) { console.log('Не удалось войти демо-пользователями. Выполните db:reset и db:seed.'); process.exit(1); }
  const Y = new Date().getFullYear();

  // ---------- профили детей ----------
  let childrenResult = await call('GET', '/children', null, user);
  check('Seed создаёт демо-профиль ребёнка, GET /children его возвращает', childrenResult.status === 200 && childrenResult.data.some((x) => x.full_name === 'Иванова Анастасия'));
  let childResult = await call('POST', '/children', { full_name: 'Тестовый ребёнок', birth_date: `${Y - 7}-05-10`, gender: 'male', consent: true }, user);
  const createdChildId = childResult.data.id;
  check('POST /children создаёт профиль только с согласием', childResult.status === 201 && !!createdChildId);
  let organizerChildren = await call('GET', '/children', null, org1);
  check('Организатор видит только собственные профили детей', organizerChildren.status === 200 && organizerChildren.data.length === 0);
  let childEdit = await call('PUT', `/children/${createdChildId}`, { full_name: 'Тестовый ребёнок 2', birth_date: `${Y - 7}-05-10`, gender: 'male' }, user);
  check('PUT /children/:id изменяет свой профиль', childEdit.status === 200 && childEdit.data.full_name === 'Тестовый ребёнок 2');
  let childDelete = await call('DELETE', `/children/${createdChildId}`, null, user);
  check('DELETE /children/:id удаляет профиль без активных заявок', childDelete.status === 200 && childDelete.data.ok === true);

  // ---------- каталог ----------
  let r = await call('GET', '/clubs');
  check('Каталог возвращает 8 активных одобренных кружков', r.data.length === 8, `получено ${r.data.length}`);

  r = await call('GET', '/clubs?free=true');
  check('Фильтр «Бесплатные» оставляет только кружки с ценой 0', r.data.length === 2 && r.data.every((c) => Number(c.price) === 0));

  r = await call('GET', '/clubs?age=5');
  check('Фильтр по возрасту 5 лет', r.data.length >= 1 && r.data.every((c) => c.age_min <= 5 && c.age_max >= 5));

  r = await call('GET', `/clubs?search=${encodeURIComponent('ГИТАР')}`);
  check('Поиск «ГИТАР» (любой регистр) находит «Гитара с нуля»', r.data.some((c) => c.title === 'Гитара с нуля'));

  r = await call('GET', '/clubs/1');
  check('Карточка кружка: расписание и свободные места', r.status === 200 && r.data.schedule.length === 2 && r.data.free_seats === 20);

  const a = await call('GET', '/clubs?age=abc'); const b = await call('GET', '/clubs/abc');
  check('Неверный ввод: ?age=abc → 400, /clubs/abc → 404 (не 500)', a.status === 400 && b.status === 404, `${a.status}/${b.status}`);

  // ---------- запись ----------
  const baseChildResult = await createChild(user, 'Саша', `${Y - 6}-06-01`);
  const baseChildId = baseChildResult.data.id;
  check('Профиль ребёнка создан через API и имеет id', baseChildResult.status === 201 && !!baseChildId);
  const legacyRegistration = await call('POST', '/registrations', {
    club_id: 8, participant_name: 'Старый формат', participant_birth_year: Y - 6, phone: '+77001234567',
  }, user);
  check('Старый формат с именем и годом больше не принимается', legacyRegistration.status === 400);

  const reg = { club_id: 8, child_id: baseChildId, phone: '+77001234567' }; // кружок 8: 4–8 лет
  r = await call('POST', '/registrations', reg, user);
  const regId = r.data.id;
  check('Запись ребёнка: код 201, статус «ожидает»', r.status === 201 && r.data.status === 'pending');

  r = await call('POST', '/registrations', reg, user);
  check('Повторная заявка на того же ребёнка: код 409', r.status === 409);

  const organizerChild = await createChild(org1, 'Ребёнок организатора', `${Y - 14}-05-01`);
  r = await call('POST', '/registrations', { club_id: 1, child_id: organizerChild.data.id, phone: '+77001234567' }, org1);
  check('Организатор не может записать своего ребёнка в собственный кружок', r.status === 403);

  r = await call('POST', '/registrations', { club_id: 6, child_id: organizerChild.data.id, phone: '+77001234567' }, user);
  check('Нельзя записать ребёнка из чужого профиля: код 404', r.status === 404);

  r = await call('POST', '/registrations', { club_id: 6, child_id: organizerChild.data.id, phone: '+77001234567' }, org1);
  check('Организатор может записать своего ребёнка в чужой кружок', r.status === 201, `код ${r.status}`);

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
    const child = await createChild(user, `Ребёнок ${i}`, `${Y - 6}-07-${String(i).padStart(2, '0')}`);
    codes.push(child.status === 201
      ? (await call('POST', '/registrations', { ...reg, child_id: child.data.id }, user)).status
      : child.status);
  }
  check('Заявки сверх вместимости (6 мест): последняя отклонена, код 409', codes.slice(0, 4).every((c) => c === 201) && codes.includes(409), JSON.stringify(codes));

  // ---------- БЛ-1: возраст ----------
  const toddler = await createChild(user, 'Малыш', `${Y - 3}-01-01`);
  r = await call('POST', '/registrations', { club_id: 6, child_id: toddler.data.id, phone: '+77001234567' }, user);
  check('БЛ-1: 3-летний в кружок 12–18 → код 400 с понятным сообщением', r.status === 400 && /12–18/.test(r.data.error || ''), JSON.stringify(r.data));

  const adult = await createChild(user, 'Взрослый', `${Y - 40}-01-01`);
  r = await call('POST', '/registrations', { club_id: 8, child_id: adult.data.id, phone: '+77001234567' }, user);
  check('БЛ-1: взрослый 40 лет в кружок 4–8 → код 400', r.status === 400);

  // ---------- БЛ-2: модерация организаторов и кружков ----------
  const clubBody = { title: 'Шахматы', category_id: 1, age_min: 6, age_max: 12, price: 0, capacity: 10, schedule: [{ weekday: 2, start_time: '15:00', end_time: '16:00' }] };
  r = await call('POST', '/organizer/clubs', clubBody, org1);
  const newClubId = r.data.id;
  const mine = await call('GET', `/organizer/clubs/${newClubId}`, null, org1);
  check('Создание кружка: код 201, статус «на проверке» (R-2)', r.status === 201 && mine.data.moderation_status === 'pending_review');

  r = await call('POST', '/organizer/clubs', { ...clubBody, schedule: [{ weekday: 2, start_time: '17:00', end_time: '16:00' }] }, org1);
  check('Расписание, где конец раньше начала: код 400', r.status === 400);

  const cat = await call('GET', '/clubs'); const hidden = await call('GET', `/clubs/${newClubId}`);
  check('БЛ-2: неодобренный кружок не виден в каталоге и по прямой ссылке', cat.data.length === 8 && hidden.status === 404);

  r = await call('POST', '/registrations', { club_id: newClubId, child_id: baseChildId, phone: '+77001234567' }, user);
  check('БЛ-2: в неодобренный кружок записаться нельзя: код 404', r.status === 404);

  r = await call('PATCH', `/admin/clubs/${newClubId}/moderation`, { status: 'approved' }, admin);
  const shown = await call('GET', `/clubs/${newClubId}`);
  check('Админ одобряет кружок: он появляется в каталоге', r.status === 200 && shown.status === 200);

  const regP = await call('POST', '/auth/register', { full_name: 'Новый Родитель', email: `p${Date.now()}@test.kz`, password: '12345678', role: 'organizer' });
  const newTok = regP.data.token;
  check('БЛ-2: регистрация с role = organizer/admin даёт роль parent (R-1)', regP.status === 201 && regP.data.user.role === 'parent');

  r = await call('POST', '/organizer/clubs', clubBody, newTok);
  check('БЛ-2: родитель не может создать кружок: код 403', r.status === 403);

  const appBody = { org_name: 'Студия «Радуга»', bin: '123456789012', phone: '+77001112233', social_url: 'https://instagram.com/raduga' };
  r = await call('POST', '/profile/organizer-application', { ...appBody, bin: '123' }, newTok);
  const badBin = r.status === 400;
  r = await call('POST', '/profile/organizer-application', appBody, newTok);
  const appId = r.data.id;
  const dup = await call('POST', '/profile/organizer-application', appBody, newTok);
  check('Заявка на роль организатора: неверный БИН → 400, повторная → 409', badBin && r.status === 201 && dup.status === 409);

  r = await call('PATCH', `/admin/organizer-applications/${appId}`, { status: 'rejected' }, admin);
  const noReason = r.status === 400;
  r = await call('PATCH', `/admin/organizer-applications/${appId}`, { status: 'approved' }, admin);
  const me = await call('GET', '/auth/me', null, newTok);
  const created = await call('POST', '/organizer/clubs', clubBody, newTok);
  check('Отказ без причины → 400; одобрение даёт роль организатора и право создавать кружок', noReason && r.status === 200 && me.data.user.role === 'organizer' && created.status === 201);

  // ---------- БЛ-3: скрытие админом ----------
  r = await call('PATCH', `/admin/clubs/${newClubId}/moderation`, { status: 'blocked' }, admin);
  const needReason = r.status === 400;
  await call('PATCH', `/admin/clubs/${newClubId}/moderation`, { status: 'blocked', comment: 'Нарушение правил' }, admin);
  const put = await call('PUT', `/organizer/clubs/${newClubId}`, { ...clubBody, is_active: true, moderation_status: 'approved' }, org1);
  const still = await call('GET', `/clubs/${newClubId}`);
  const own = await call('GET', `/organizer/clubs/${newClubId}`, null, org1);
  check('БЛ-3: организатор не может вернуть кружок, заблокированный админом', needReason && put.status === 200 && still.status === 404 && own.data.moderation_status === 'blocked', JSON.stringify([put.status, still.status, own.data.moderation_status]));

  r = await call('PATCH', '/admin/clubs/1/moderation', { status: 'approved' }, admin);
  const edit = await call('PUT', '/organizer/clubs/1', { title: 'Школа футбола «Старт» (новое название)', category_id: 1, age_min: 7, age_max: 14, price: 0, capacity: 20, schedule: [] }, org1);
  check('R-2: смена названия отправляет кружок на повторную проверку', edit.data.moderation_status === 'pending_review', JSON.stringify(edit.data));
  await call('PATCH', '/admin/clubs/1/moderation', { status: 'approved' }, admin);
  const edit2 = await call('PUT', '/organizer/clubs/1', { title: 'Школа футбола «Старт» (новое название)', category_id: 1, age_min: 7, age_max: 14, price: 500, capacity: 20, schedule: [] }, org1);
  check('R-2: смена цены повторной проверки не требует', edit2.data.moderation_status === 'approved');

  // ---------- R-6: места не ниже числа подтверждённых ----------
  const dima = await createChild(user, 'Дима', `${Y - 9}-04-01`);
  const anya = await createChild(user, 'Аня', `${Y - 9}-05-01`);
  const pid = (await call('POST', '/registrations', { club_id: 1, child_id: dima.data.id, phone: '+77001234567' }, user)).data.id;
  const pid2 = (await call('POST', '/registrations', { club_id: 1, child_id: anya.data.id, phone: '+77001234567' }, user)).data.id;
  await call('PATCH', `/organizer/registrations/${pid}`, { status: 'confirmed' }, org1);
  await call('PATCH', `/organizer/registrations/${pid2}`, { status: 'confirmed' }, org1);
  r = await call('PUT', '/organizer/clubs/1', { title: 'Школа футбола «Старт» (новое название)', category_id: 1, age_min: 7, age_max: 14, price: 500, capacity: 1, schedule: [] }, org1);
  check('R-6: нельзя уменьшить места ниже числа подтверждённых: код 400', r.status === 400);

  // ---------- права и данные ----------
  r = await call('GET', '/admin/users', null, user);
  check('Родитель обращается к админ-маршруту: код 403', r.status === 403);

  r = await call('DELETE', '/admin/categories/1', null, admin);
  check('Удаление категории, в которой есть кружки: код 409', r.status === 409);

  r = await call('PUT', '/profile', { full_name: 'Анна Новая', phone: '+77001112233' }, org1);
  check('Изменение профиля: код 200', r.status === 200 && r.data.user.full_name === 'Анна Новая');

  r = await call('GET', '/admin/registrations', null, admin);
  const pending = (r.data || []).find((x) => x.status === 'pending');
  const r2 = pending ? await call('PATCH', `/admin/registrations/${pending.id}`, { status: 'rejected' }, admin) : { status: 0 };
  check('Админ видит все заявки и может обработать заявку', r.status === 200 && r.data.length > 0 && r2.status === 200);

  r = await call('GET', '/admin/log', null, admin);
  check('Журнал действий админа содержит записи о модерации', r.status === 200 && r.data.some((x) => x.action === 'club_blocked'));

  // ---------- БЛ-4: блокировка организатора ----------
  const before = await call('GET', '/clubs');
  r = await call('PATCH', '/admin/users/3/block', null, admin); // organizer2: кружки 5-8
  const after = await call('GET', '/clubs');
  const c6 = await call('GET', '/clubs/6');
  const regBlocked = await call('POST', '/registrations', { club_id: 6, child_id: baseChildId, phone: '+77001234567' }, user);
  const allRegs = await call('GET', '/admin/registrations', null, admin);
  const systemCancelled = allRegs.data.filter((x) => x.club_id >= 5 && x.club_id <= 8 && x.status === 'cancelled_by_system').length;
  const stillActive = allRegs.data.filter((x) => x.club_id >= 5 && x.club_id <= 8 && ['pending', 'confirmed'].includes(x.status)).length;
  check('БЛ-4: кружки заблокированного организатора исчезают из каталога, записаться нельзя',
    r.status === 200 && after.data.length === before.data.length - 4 && c6.status === 404 && regBlocked.status === 404,
    `${before.data.length}→${after.data.length}`);
  check('БЛ-4: активные заявки отменяются со статусом cancelled_by_system', r.data.cancelled_registrations > 0 && systemCancelled === r.data.cancelled_registrations && stillActive === 0, JSON.stringify([r.data, systemCancelled, stillActive]));

  // ---------- блокировка родителя ----------
  r = await call('PATCH', '/admin/users/4/block', null, admin);
  const blocked = r.status === 200 && r.data.is_blocked === true;
  const l = await call('POST', '/auth/login', { email: 'user@kruzhki.local', password: 'user1234' });
  const old = await call('GET', '/registrations/my', null, user);
  check('Блокировка: вход и старый токен дают код 403', blocked && l.status === 403 && old.status === 403);

  console.log(`\nИтог: пройдено ${passed} из ${n}` + (failed ? `, провалено ${failed}` : ''));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('Ошибка теста:', e.message); process.exit(1); });
