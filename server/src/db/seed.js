
// Заполняет базу демо-данными: npm run db:seed

const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hash = (password) => bcrypt.hashSync(password, 10);

    // Создание или обновление пользователей
    async function saveUser(fullName, email, password, phone, role) {
      const passwordHash = hash(password);

      const result = await client.query(
        `SELECT id, email, phone
         FROM users
         WHERE email = $1 OR phone = $2`,
        [email, phone]
      );

      if (result.rows.length > 1) {
        throw new Error(
          `Найдены разные пользователи с email ${email} или телефоном ${phone}`
        );
      }

      if (result.rows.length === 1) {
        const user = result.rows[0];

        const updated = await client.query(
          `UPDATE users
           SET full_name = $1,
               email = $2,
               password_hash = $3,
               phone = $4,
               role = $5
           WHERE id = $6
           RETURNING id, email`,
          [fullName, email, passwordHash, phone, role, user.id]
        );

        return updated.rows[0];
      }

      const inserted = await client.query(
        `INSERT INTO users
         (full_name, email, password_hash, phone, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email`,
        [fullName, email, passwordHash, phone, role]
      );

      return inserted.rows[0];
    }

    const admin = await saveUser(
      'Администратор',
      'admin@kruzhki.local',
      'admin123',
      '+77000000000',
      'admin'
    );

    const organizer1 = await saveUser(
      'Анна Петрова',
      'organizer@kruzhki.local',
      'org12345',
      '+77001112233',
      'organizer'
    );

    const organizer2 = await saveUser(
      'Игорь Соколов',
      'organizer2@kruzhki.local',
      'org12345',
      '+77004445566',
      'organizer'
    );

    const parent = await saveUser(
      'Мария Иванова',
      'user@kruzhki.local',
      'user1234',
      '+77009998877',
      'parent'
    );

    // Создание или получение категорий
    async function getCategory(name) {
      const result = await client.query(
        'SELECT id FROM categories WHERE name = $1',
        [name]
      );

      if (result.rows.length > 0) {
        return result.rows[0].id;
      }

      const inserted = await client.query(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id',
        [name]
      );

      return inserted.rows[0].id;
    }

    const categoryNames = [
      'Спорт',
      'Музыка',
      'Программирование',
      'Рисование',
      'Танцы',
      'Иностранные языки',
    ];

    const categories = {};

    for (const name of categoryNames) {
      categories[name] = await getCategory(name);
    }

    // Демо-кружки
    const clubs = [
      [organizer1.id, 'Школа футбола «Старт»', 'Командные тренировки для начинающих, два тренера, форма не нужна.', 7, 14, 0, 'ул. Спортивная, 12', 20, 'Спорт'],
      [organizer1.id, 'Юный программист', 'Основы Python и создание первых игр. Занятия в классе с компьютерами.', 10, 16, 15000, 'пр. Абая, 45, каб. 3', 12, 'Программирование'],
      [organizer1.id, 'Студия живописи', 'Акварель и гуашь, выставка работ в конце семестра.', 6, 12, 8000, 'ул. Мира, 7', 10, 'Рисование'],
      [organizer1.id, 'Хор «Звонкие голоса»', 'Вокал, сольфеджио, выступления на городских праздниках.', 7, 15, 0, 'Дом культуры, зал 2', 25, 'Музыка'],
      [organizer2.id, 'Гитара с нуля', 'Групповые занятия, гитару можно взять в аренду.', 9, 17, 10000, 'ул. Гоголя, 21', 8, 'Музыка'],
      [organizer2.id, 'Хип-хоп для подростков', 'Современные танцы, подготовка к фестивалю.', 12, 18, 9000, 'Спорткомплекс «Олимп»', 15, 'Танцы'],
      [organizer2.id, 'English Club', 'Разговорный английский в игровой форме.', 8, 14, 12000, 'ул. Ленина, 3, каб. 10', 10, 'Иностранные языки'],
      [organizer2.id, 'Плавание для малышей', 'Группы по возрасту, бассейн с подогревом.', 4, 8, 14000, 'Бассейн «Волна»', 6, 'Спорт'],
    ];

    let i = 0;

    for (const [organizerId, title, description, ageMin, ageMax, price, address, capacity, categoryName] of clubs) {
      const categoryId = categories[categoryName];

      const existing = await client.query(
        `SELECT id
         FROM clubs
         WHERE organizer_id = $1 AND title = $2
         LIMIT 1`,
        [organizerId, title]
      );

      let clubId;

      if (existing.rows.length > 0) {
        const updated = await client.query(
          `UPDATE clubs
           SET category_id = $1,
               description = $2,
               age_min = $3,
               age_max = $4,
               price = $5,
               address = $6,
               capacity = $7,
               moderation_status = 'approved'
           WHERE id = $8
           RETURNING id`,
          [categoryId, description, ageMin, ageMax, price, address, capacity, existing.rows[0].id]
        );

        clubId = updated.rows[0].id;
      } else {
        const inserted = await client.query(
          `INSERT INTO clubs
           (organizer_id, category_id, title, description, age_min, age_max, price, address, capacity, moderation_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
           RETURNING id`,
          [organizerId, categoryId, title, description, ageMin, ageMax, price, address, capacity]
        );

        clubId = inserted.rows[0].id;
      }

      // Добавляем расписание, только если таких записей ещё нет
      const weekday1 = (i % 5) + 1;
      const weekday2 = weekday1 + 2;

      for (const weekday of [weekday1, weekday2]) {
        await client.query(
          `INSERT INTO schedules (club_id, weekday, start_time, end_time)
           SELECT $1, $2, '16:00', '17:30'
           WHERE NOT EXISTS (
             SELECT 1
             FROM schedules
             WHERE club_id = $1
               AND weekday = $2
               AND start_time = '16:00'
               AND end_time = '17:30'
           )`,
          [clubId, weekday]
        );
      }

      i++;
    }

    await client.query('COMMIT');

    console.log('Демо-данные успешно добавлены или обновлены.');
    console.log('');
    console.log('Данные для входа:');
    console.log('Администратор: admin@kruzhki.local / admin123');
    console.log('Организатор: organizer@kruzhki.local / org12345');
    console.log('Пользователь: user@kruzhki.local / user1234');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Ошибка заполнения базы:', error);
  process.exitCode = 1;
});
