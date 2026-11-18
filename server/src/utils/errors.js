// Ответ 500: подробности (код и текст ошибки базы) показываем только в режиме разработки,
// на рабочем сервере (NODE_ENV=production) пользователь видит только «Ошибка сервера».
function serverError(res, e) {
  console.error(e);
  const body = { error: 'Ошибка сервера' };
  if (process.env.NODE_ENV !== 'production') body.details = `${e.code ? e.code + ': ' : ''}${e.message}`;
  res.status(500).json(body);
}
module.exports = { serverError };
