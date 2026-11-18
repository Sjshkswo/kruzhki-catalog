// Заполняет базу демо-данными: npm run db:seed
const bcrypt = require('bcryptjs');
const pool = require('./pool');

(async () => {
  const hash = (p) => bcrypt.hashSync(p, 10);

  const users = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, phone, role) VALUES
     ('Администратор', 'admin@kruzhki.local', $1, '+77000000000', 'admin'),
     ('Анна Петрова', 'organizer@kruzhki.local', $2, '+77001112233', 'organizer'),
     ('Игорь Соколов', 'organizer2@kruzhki.local', $2, '+77004445566', 'organizer'),
     ('Мария Иванова', 'user@kruzhki.local', $3, '+77009998877', 'parent')
     RETURNING id, email`,
    [hash('admin123'), hash('org12345'), hash('user1234')]
  );
  const org1 = users.rows.find((u) => u.email === 'organizer@kruzhki.local').id;
  const org2 = users.rows.find((u) => u.email === 'organizer2@kruzhki.local').id;

  const cats = await pool.query(
    `INSERT INTO categories (name) VALUES
     ('Спорт'), ('Музыка'), ('Программирование'), ('Рисование'), ('Танцы'), ('Иностранные языки')
     RETURNING id, name`
  );
  const cat = (n) => cats.rows.find((c) => c.name === n).id;

  const clubs = [
    [org1, 'Школа футбола «Старт»', 'Командные тренировки для начинающих, два тренера, форма не нужна.', 7, 14, 0, 'ул. Спортивная, 12', 20, 'Спорт'],
    [org1, 'Юный программист', 'Основы Python и создание первых игр. Занятия в классе с компьютерами.', 10, 16, 15000, 'пр. Абая, 45, каб. 3', 12, 'Программирование'],
    [org1, 'Студия живописи', 'Акварель и гуашь, выставка работ в конце семестра.', 6, 12, 8000, 'ул. Мира, 7', 10, 'Рисование'],
    [org1, 'Хор «Звонкие голоса»', 'Вокал, сольфеджио, выступления на городских праздниках.', 7, 15, 0, 'Дом культуры, зал 2', 25, 'Музыка'],
    [org2, 'Гитара с нуля', 'Групповые занятия, гитару можно взять в аренду.', 9, 17, 10000, 'ул. Гоголя, 21', 8, 'Музыка'],
    [org2, 'Хип-хоп для подростков', 'Современные танцы, подготовка к фестивалю.', 12, 18, 9000, 'Спорткомплекс «Олимп»', 15, 'Танцы'],
    [org2, 'English Club', 'Разговорный английский в игровой форме.', 8, 14, 12000, 'ул. Ленина, 3, каб. 10', 10, 'Иностранные языки'],
    [org2, 'Плавание для малышей', 'Группы по возрасту, бассейн с подогревом.', 4, 8, 14000, 'Бассейн «Волна»', 6, 'Спорт'],
  ];
  let i = 0;
  for (const [org, title, desc, amin, amax, price, addr, cap, catName] of clubs) {
    const r = await pool.query(
      `INSERT INTO clubs (organizer_id, category_id, title, description, age_min, age_max, price, address, capacity, moderation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved') RETURNING id`,
      [org, cat(catName), title, desc, amin, amax, price, addr, cap]
    );
    const d1 = (i % 5) + 1;
    await pool.query(
      `INSERT INTO schedules (club_id, weekday, start_time, end_time) VALUES ($1,$2,'16:00','17:30'), ($1,$3,'16:00','17:30')`,
      [r.rows[0].id, d1, d1 + 2]
    );
    i++;
  }
  console.log('Демо-данные добавлены');
  console.log('admin@kruzhki.local / admin123');
  console.log('organizer@kruzhki.local / org12345');
  console.log('user@kruzhki.local / user1234');
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
