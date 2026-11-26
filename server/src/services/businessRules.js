function calculateAge(birthDate, onDate = new Date()) {
  const birth = new Date(`${String(birthDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(birth.getTime())) throw new Error('Некорректная дата рождения');
  let age = onDate.getFullYear() - birth.getFullYear();
  if (onDate.getMonth() < birth.getMonth() || (onDate.getMonth() === birth.getMonth() && onDate.getDate() < birth.getDate())) age--;
  return age;
}

function isAgeAllowed(age, min, max) {
  return Number.isInteger(age) && age >= Number(min) && age <= Number(max);
}

function validateSchedule(schedule = []) {
  const minutes = value => {
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  for (const item of schedule) {
    const start = minutes(item.start_time), end = minutes(item.end_time);
    if (!Number.isInteger(item.weekday) || item.weekday < 1 || item.weekday > 7 || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return 'Проверьте день и время занятия';
    }
    if (end - start < 15 || end - start > 240) {
      return 'Длительность занятия: от 15 минут до 4 часов';
    }
  }
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const a = schedule[i], b = schedule[j];
      if (a.weekday === b.weekday && a.start_time < b.end_time && b.start_time < a.end_time) {
        return 'Занятия в один день не должны пересекаться';
      }
    }
  }
  return null;
}

function chooseRegistrationStatus(capacity, confirmed, pending) {
  const free = Math.max(0, Number(capacity) - Number(confirmed));
  return free === 0 || Number(pending) >= free ? 'waitlist' : 'pending';
}

// R-2: Изменение цены, расписания и мест повторной модерации не требует.
// Изменение названия, описания, возраста и фото — требует.
function needsModerationOnUpdate(oldClub, newClub) {
  if (oldClub.title !== newClub.title) return true;
  if (oldClub.description !== newClub.description) return true;
  if (Number(oldClub.age_min) !== Number(newClub.age_min)) return true;
  if (Number(oldClub.age_max) !== Number(newClub.age_max)) return true;
  if (newClub.photosChanged) return true;
  return false;
}

// R-4: В каталоге показываются только кружки с is_active=true, moderation_status='approved' и незаблокированным организатором
function isClubVisibleInCatalog(club, organizer) {
  return Boolean(club.is_active) && club.moderation_status === 'approved' && !organizer?.is_blocked;
}

// R-6: Число мест нельзя уменьшить ниже числа заявок со статусом confirmed
function canDecreaseCapacity(newCapacity, confirmedCount) {
  return Number(newCapacity) >= Number(confirmedCount);
}

// R-8: Валидация цены и периода
function validatePriceAndPeriod(price, period) {
  if (Number(price) < 0 || !Number.isFinite(Number(price))) return false;
  return ['lesson', 'month', 'course', 'free'].includes(period);
}

// R-16: Организатор может перевести confirmed -> removed (выбыл)
function canMarkRemoved(currentStatus) {
  return currentStatus === 'confirmed';
}

// R-17: Ошибочное отклонение: вернуть rejected -> pending в течение 24 часов
function canRevertRejected(decidedAt, now = Date.now()) {
  if (!decidedAt) return false;
  const t = new Date(decidedAt).getTime();
  return now - t <= 24 * 60 * 60 * 1000;
}

// R-18: Организатор не может записывать детей в свои кружки
function canRegisterToClub(userRole, userId, clubOrganizerId) {
  if (userRole === 'organizer' && Number(userId) === Number(clubOrganizerId)) {
    return false;
  }
  return true;
}

// R-21: Отзыв может оставить только родитель, у ребёнка которого заявка confirmed не меньше 14 дней
function canLeaveReview(confirmedAt, onDate = new Date()) {
  if (!confirmedAt) return false;
  const conf = new Date(confirmedAt).getTime();
  const now = new Date(onDate).getTime();
  return now - conf >= 14 * 24 * 60 * 60 * 1000;
}

// R-21: Валидация отзыва (оценка 1..5, текст 10..1000)
function validateReview(rating, text) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return false;
  if (typeof text !== 'string') return false;
  const len = text.trim().length;
  return len >= 10 && len <= 1000;
}

// R-23: Рейтинг кружка = среднее по видимым отзывам; показывается, если отзывов от 3
function calculateAverageRating(reviews = []) {
  const visible = reviews.filter(r => !r.is_hidden);
  if (visible.length < 3) return null;
  const sum = visible.reduce((acc, r) => acc + Number(r.rating), 0);
  return Math.round((sum / visible.length) * 10) / 10;
}

// S-4: Пароль >= 8 символов
function isPasswordStrong(password) {
  return typeof password === 'string' && password.length >= 8;
}

// S-7: Валидация id и числовых параметров
function isValidIntegerId(id) {
  return /^\d+$/.test(String(id).trim()) && Number(id) > 0 && Number.isSafeInteger(Number(id));
}

module.exports = {
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
};
