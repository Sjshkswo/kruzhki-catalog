// Проверка возраста по году рождения.
// Точной даты рождения пока нет (появится вместе с профилями детей), поэтому
// возраст в этом году может быть (год_сейчас − год_рождения) или на единицу меньше.
// Ребёнок подходит, если хотя бы одно из двух значений попадает в диапазон кружка.
function ageFits(birthYear, ageMin, ageMax, nowYear = new Date().getFullYear()) {
  const older = nowYear - birthYear;
  const younger = older - 1;
  return (older >= ageMin && older <= ageMax) || (younger >= ageMin && younger <= ageMax);
}
const approxAge = (birthYear, nowYear = new Date().getFullYear()) => nowYear - birthYear;
module.exports = { ageFits, approxAge };
