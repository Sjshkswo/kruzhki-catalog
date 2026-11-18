const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateAge,
  isAgeAllowed,
  validateSchedule,
  chooseRegistrationStatus,
  needsModerationOnUpdate,
  isClubVisibleInCatalog,
  canDecreaseCapacity,
  validatePriceAndPeriod,
  canMarkRemoved,
  canRevertRejected,
  canRegisterToClub,
  canLeaveReview,
  validateReview,
  calculateAverageRating,
  isPasswordStrong,
  isValidIntegerId,
} = require('../src/services/businessRules');
const { normalizePhone } = require('../src/services/phone');

const today = new Date(2026, 10, 17);

test('Вход по телефону нормализует международный номер', () => {
  assert.equal(normalizePhone('+7 (700) 123-45-67'), '+77001234567');
  assert.equal(normalizePhone('77001234567'), '+77001234567');
});
test('Невалидный телефон не принимается как логин', () => {
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone('+01234567'), null);
  assert.equal(normalizePhone('+1abc2345678'), null);
  assert.equal(normalizePhone('+1234567890123456'), null);
});

// R-10: Расчёт и проверка возраста
test('R-10: возраст на дату расчёта', () => assert.equal(calculateAge('2012-11-16', today), 14));
test('R-10: до дня рождения возраст ещё не увеличился', () => assert.equal(calculateAge('2012-11-18', today), 13));
test('R-10: возраст учитывает месяц', () => assert.equal(calculateAge('2012-12-01', today), 13));
test('R-10: возраст учитывает год', () => assert.equal(calculateAge('2020-01-01', today), 6));
test('R-10: допустимый минимальный возраст', () => assert.equal(isAgeAllowed(5, 5, 12), true));
test('R-10: допустимый максимальный возраст', () => assert.equal(isAgeAllowed(12, 5, 12), true));
test('R-10: возраст ниже минимума отклоняется', () => assert.equal(isAgeAllowed(4, 5, 12), false));
test('R-10: возраст выше максимума отклоняется', () => assert.equal(isAgeAllowed(13, 5, 12), false));
test('R-10: нецелый возраст отклоняется', () => assert.equal(isAgeAllowed(5.5, 5, 12), false));

// R-12, R-13: Выбор статуса заявки (pending / waitlist)
test('R-12: кружок с местами принимает pending', () => assert.equal(chooseRegistrationStatus(5, 2, 1), 'pending'));
test('R-13: при заполнении confirmed заявка в waitlist', () => assert.equal(chooseRegistrationStatus(5, 5, 0), 'waitlist'));
test('R-12: при pending на все свободные места новая заявка в waitlist', () => assert.equal(chooseRegistrationStatus(5, 2, 3), 'waitlist'));
test('R-13: нулевая вместимость приводит в очередь', () => assert.equal(chooseRegistrationStatus(0, 0, 0), 'waitlist'));

// R-7: Валидация расписания
test('R-7: занятие 15 минут допустимо', () => assert.equal(validateSchedule([{ weekday: 1, start_time: '10:00', end_time: '10:15' }]), null));
test('R-7: занятие 4 часа допустимо', () => assert.equal(validateSchedule([{ weekday: 1, start_time: '09:00', end_time: '13:00' }]), null));
test('R-7: занятие короче 15 минут запрещено', () => assert.match(validateSchedule([{ weekday: 1, start_time: '10:00', end_time: '10:14' }]), /15 минут/));
test('R-7: занятие длиннее 4 часов запрещено', () => assert.match(validateSchedule([{ weekday: 1, start_time: '09:00', end_time: '13:01' }]), /4 часов/));
test('R-7: пересечение в один день запрещено', () => assert.match(validateSchedule([{ weekday: 1, start_time: '10:00', end_time: '11:00' }, { weekday: 1, start_time: '10:30', end_time: '11:30' }]), /пересекаться/));
test('R-7: одинаковое время в разные дни допустимо', () => assert.equal(validateSchedule([{ weekday: 1, start_time: '10:00', end_time: '11:00' }, { weekday: 2, start_time: '10:00', end_time: '11:00' }]), null));
test('R-7: неверный день недели запрещён', () => assert.ok(validateSchedule([{ weekday: 8, start_time: '10:00', end_time: '11:00' }])));
test('R-7: время окончания должно быть позже начала', () => assert.ok(validateSchedule([{ weekday: 1, start_time: '11:00', end_time: '10:00' }])));

// R-2: Модерация при изменении кружка
test('R-2: изменение названия требует модерации', () => {
  assert.equal(needsModerationOnUpdate({ title: 'A', description: 'D', age_min: 5, age_max: 10 }, { title: 'B', description: 'D', age_min: 5, age_max: 10 }), true);
});
test('R-2: изменение описания требует модерации', () => {
  assert.equal(needsModerationOnUpdate({ title: 'A', description: 'D1', age_min: 5, age_max: 10 }, { title: 'A', description: 'D2', age_min: 5, age_max: 10 }), true);
});
test('R-2: изменение возраста требует модерации', () => {
  assert.equal(needsModerationOnUpdate({ title: 'A', description: 'D', age_min: 5, age_max: 10 }, { title: 'A', description: 'D', age_min: 6, age_max: 10 }), true);
});
test('R-2: изменение фото требует модерации', () => {
  assert.equal(needsModerationOnUpdate({ title: 'A', description: 'D', age_min: 5, age_max: 10 }, { title: 'A', description: 'D', age_min: 5, age_max: 10, photosChanged: true }), true);
});
test('R-2: изменение цены или мест НЕ требует модерации', () => {
  assert.equal(needsModerationOnUpdate({ title: 'A', description: 'D', age_min: 5, age_max: 10, price: 100 }, { title: 'A', description: 'D', age_min: 5, age_max: 10, price: 200 }), false);
});

// R-4: Видимость кружка в каталоге
test('R-4: одобренный активный кружок с активным организатором виден', () => {
  assert.equal(isClubVisibleInCatalog({ is_active: true, moderation_status: 'approved' }, { is_blocked: false }), true);
});
test('R-4: неактивный кружок скрыт из каталога', () => {
  assert.equal(isClubVisibleInCatalog({ is_active: false, moderation_status: 'approved' }, { is_blocked: false }), false);
});
test('R-4: кружок на модерации скрыт из каталога', () => {
  assert.equal(isClubVisibleInCatalog({ is_active: true, moderation_status: 'pending_review' }, { is_blocked: false }), false);
});
test('R-4: кружок заблокированного организатора скрыт из каталога', () => {
  assert.equal(isClubVisibleInCatalog({ is_active: true, moderation_status: 'approved' }, { is_blocked: true }), false);
});

// R-6: Ограничение уменьшения мест
test('R-6: нельзя уменьшить число мест ниже подтверждённых заявок', () => {
  assert.equal(canDecreaseCapacity(5, 6), false);
  assert.equal(canDecreaseCapacity(6, 6), true);
  assert.equal(canDecreaseCapacity(10, 6), true);
});

// R-8: Цена и период
test('R-8: допустимые периоды оплаты', () => {
  assert.equal(validatePriceAndPeriod(5000, 'month'), true);
  assert.equal(validatePriceAndPeriod(1000, 'lesson'), true);
  assert.equal(validatePriceAndPeriod(25000, 'course'), true);
  assert.equal(validatePriceAndPeriod(0, 'free'), true);
  assert.equal(validatePriceAndPeriod(5000, 'year'), false);
  assert.equal(validatePriceAndPeriod(-100, 'month'), false);
});

// R-16: Перевод в статус removed
test('R-16: исключить (removed) можно только confirmed заявку', () => {
  assert.equal(canMarkRemoved('confirmed'), true);
  assert.equal(canMarkRemoved('pending'), false);
  assert.equal(canMarkRemoved('waitlist'), false);
});

// R-17: Возврат ошибочно отклонённой заявки
test('R-17: отклонённую заявку можно вернуть в течение 24 часов', () => {
  const now = Date.now();
  assert.equal(canRevertRejected(now - 1000 * 60 * 60 * 2, now), true); // 2 часа назад
  assert.equal(canRevertRejected(now - 1000 * 60 * 60 * 25, now), false); // 25 часов назад
});

// R-18: Организатор не может записывать детей в свои кружки
test('R-18: организатор не может записать детей в свой кружок', () => {
  assert.equal(canRegisterToClub('organizer', 42, 42), false);
  assert.equal(canRegisterToClub('organizer', 42, 99), true);
  assert.equal(canRegisterToClub('parent', 42, 42), true);
});

// R-21: Отзывы (14 дней после подтверждения)
test('R-21: отзыв разрешён только через 14 дней после подтверждения', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const d13 = new Date('2026-11-04T00:00:00Z'); // 13.5 дней
  const d14 = new Date('2026-11-03T00:00:00Z'); // 14.5 дней
  assert.equal(canLeaveReview(d13, now), false);
  assert.equal(canLeaveReview(d14, now), true);
});

test('R-21: валидация текста и оценки отзыва', () => {
  assert.equal(validateReview(5, 'Отличный кружок, ребенок в восторге!'), true);
  assert.equal(validateReview(0, 'Отличный кружок!'), false); // оценка < 1
  assert.equal(validateReview(6, 'Отличный кружок!'), false); // оценка > 5
  assert.equal(validateReview(5, 'Коротко'), false); // длина < 10
  assert.equal(validateReview(5, 'A'.repeat(1001)), false); // длина > 1000
});

// R-23: Рейтинг от 3 отзывов
test('R-23: рейтинг показывается только если отзывов не менее 3', () => {
  assert.equal(calculateAverageRating([{ rating: 5 }, { rating: 4 }]), null);
  assert.equal(calculateAverageRating([{ rating: 5 }, { rating: 4 }, { rating: 3 }]), 4.0);
  assert.equal(calculateAverageRating([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 2, is_hidden: true }]), 4.7);
});

// S-4: Пароль >= 8 символов
test('S-4: пароль минимум 8 символов', () => {
  assert.equal(isPasswordStrong('short'), false);
  assert.equal(isPasswordStrong('1234567'), false);
  assert.equal(isPasswordStrong('password123'), true);
});

// S-7: Валидация id параметров
test('S-7: валидация числового ID (отсутствие 500 при неверном id)', () => {
  assert.equal(isValidIntegerId(12), true);
  assert.equal(isValidIntegerId('42'), true);
  assert.equal(isValidIntegerId('abc'), false);
  assert.equal(isValidIntegerId(-5), false);
  assert.equal(isValidIntegerId('0'), false);
  assert.equal(isValidIntegerId(''), false);
});
