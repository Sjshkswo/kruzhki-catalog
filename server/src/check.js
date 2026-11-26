// Полная проверка окружения: npm run check
const net = require('net');
const pool = require('./db/pool');
const { runChecks } = require('./startupCheck');

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

(async () => {
  console.log('Проверка окружения сервера\n');
  const results = await runChecks();
  const port = Number(process.env.PORT) || 4000;
  const busy = await portInUse(port);
  results.push({ ok: true, title: busy ? `Порт ${port} занят: сервер, вероятно, уже запущен` : `Порт ${port} свободен`,
    hint: busy ? 'Если запускаете второй раз, закройте старое окно с сервером (Ctrl+C) или откройте http://localhost:' + port + '/api/categories' : '' });
  results.push({ ok: true, title: process.env.MAIL_USER && process.env.MAIL_PASS ? 'Почта настроена' : 'Почта не настроена (письма не отправляются, это не ошибка)', hint: '' });

  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.title}`);
    if (r.hint) console.log(`      → ${r.hint}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\nПроблем: ${failed}. Исправьте их по подсказкам и запустите проверку снова.` : '\nВсё в порядке: можно запускать npm start');
  await pool.end();
  process.exit(failed ? 1 : 0);
})();
