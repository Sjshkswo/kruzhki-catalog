// Проверка возраста по году рождения для старых заявок, в которых нет даты рождения.
function ageFits(birthYear, ageMin, ageMax, nowYear = new Date().getFullYear()) {
  const older = nowYear - birthYear;
  const younger = older - 1;
  return (older >= ageMin && older <= ageMax) || (younger >= ageMin && younger <= ageMax);
}

// Точная проверка возраста на указанную дату (R-10).
function ageAtDate(birthDate, referenceDate = new Date()) {
  const birth = new Date(`${String(birthDate).slice(0, 10)}T00:00:00.000Z`);
  const reference = new Date(referenceDate);
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday = reference.getUTCMonth() < birth.getUTCMonth() ||
    (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

const approxAge = (birthYear, nowYear = new Date().getFullYear()) => nowYear - birthYear;
module.exports = { ageFits, ageAtDate, approxAge };
