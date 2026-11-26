-- Итоговая схема Kruzhki Catalog.
-- Один идемпотентный migration-файл для новых и уже существующих баз.
-- ВАЖНО: миграция не удаляет таблицы и пользовательские данные.

-- 1. Пользователи и категории
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'parent',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at TIMESTAMPTZ,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
UPDATE users SET role = 'parent' WHERE role = 'participant';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'parent';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('parent', 'organizer', 'admin', 'manager'));

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

-- 2. Кружки
CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  organizer_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id INT NOT NULL REFERENCES categories(id),
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  age_min INT NOT NULL DEFAULT 5 CHECK (age_min >= 0),
  age_max INT NOT NULL DEFAULT 18 CHECK (age_max >= age_min),
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  price_period VARCHAR(10) NOT NULL DEFAULT 'month',
  address VARCHAR(255) NOT NULL DEFAULT '',
  capacity INT NOT NULL DEFAULT 10 CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  moderation_comment TEXT,
  season_start DATE,
  season_end DATE,
  free_trial BOOLEAN NOT NULL DEFAULT FALSE,
  contact_phone VARCHAR(20),
  contact_whatsapp VARCHAR(20),
  district VARCHAR(50),
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Для старых баз добавляем новые поля без пересоздания таблицы.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS moderation_comment TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'clubs'
      AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE clubs ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending_review';
    -- Старые опубликованные кружки не должны исчезнуть после обновления.
    UPDATE clubs SET moderation_status = 'approved';
  END IF;
END $$;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS price_period VARCHAR(10) NOT NULL DEFAULT 'month';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS season_start DATE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS season_end DATE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS free_trial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_whatsapp VARCHAR(20);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_organizer_id_fkey;
ALTER TABLE clubs ADD CONSTRAINT clubs_organizer_id_fkey
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_moderation_status_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_moderation_status_check
  CHECK (moderation_status IN ('pending_review', 'approved', 'rejected', 'blocked'));
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_price_period_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_price_period_check
  CHECK (price_period IN ('lesson', 'month', 'course', 'free'));

-- 3. Расписание и профили детей
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  full_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL CHECK (birth_date > DATE '1920-01-01'),
  gender VARCHAR(20),
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Заявки на запись
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  participant_name VARCHAR(100) NOT NULL,
  participant_birth_year INT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  comment TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  child_id INT REFERENCES children(id) ON DELETE RESTRICT,
  waitlist_position INT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS child_id INT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_user_id_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_child_id_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_child_id_fkey
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE RESTRICT;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check
  CHECK (status IN (
    'waitlist', 'pending', 'confirmed', 'rejected', 'removed', 'expired',
    'cancelled', 'cancelled_by_organizer', 'cancelled_by_system'
  ));

-- Перенос старых текстовых участников в отдельные профили детей.
-- Исходные заявки и их поля не удаляются и не переписываются.
INSERT INTO children (parent_id, full_name, birth_date, consent_at)
SELECT r.user_id,
       MIN(BTRIM(r.participant_name)),
       make_date(r.participant_birth_year, 1, 1),
       NOW()
FROM registrations r
WHERE r.participant_birth_year > 1920
  AND r.participant_birth_year <= EXTRACT(YEAR FROM CURRENT_DATE)::INT
  AND NOT EXISTS (
    SELECT 1
    FROM children c
    WHERE c.parent_id = r.user_id
      AND LOWER(BTRIM(c.full_name)) = LOWER(BTRIM(r.participant_name))
      AND EXTRACT(YEAR FROM c.birth_date)::INT = r.participant_birth_year
  )
GROUP BY r.user_id, LOWER(BTRIM(r.participant_name)), r.participant_birth_year;

UPDATE registrations r
SET child_id = c.id
FROM children c
WHERE r.child_id IS NULL
  AND c.parent_id = r.user_id
  AND LOWER(BTRIM(c.full_name)) = LOWER(BTRIM(r.participant_name))
  AND EXTRACT(YEAR FROM c.birth_date)::INT = r.participant_birth_year;

-- 5. Заявки организаторов, фотографии, история и администрирование
CREATE TABLE IF NOT EXISTS organizer_applications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  org_name VARCHAR(150) NOT NULL,
  bin VARCHAR(12) CHECK (bin IS NULL OR bin ~ '^[0-9]{12}$'),
  phone VARCHAR(20) NOT NULL,
  social_url VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_photos (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  stored_name VARCHAR(100) NOT NULL UNIQUE,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS registration_history (
  id SERIAL PRIMARY KEY,
  registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_log (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id INT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Отзывы, избранное и уведомления
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL CHECK (LENGTH(text) BETWEEN 10 AND 1000),
  organizer_reply TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, club_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  dedup_key VARCHAR(100),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Индексы
CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category_id);
DROP INDEX IF EXISTS idx_clubs_moderation;
CREATE INDEX idx_clubs_moderation ON clubs(moderation_status, is_active);
CREATE INDEX IF NOT EXISTS idx_clubs_district ON clubs(district);
CREATE INDEX IF NOT EXISTS idx_registrations_club ON registrations(club_id);
CREATE INDEX IF NOT EXISTS idx_registrations_club_status ON registrations(club_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_registration_history_registration ON registration_history(registration_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_application
  ON organizer_applications(user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_child
  ON registrations(club_id, child_id)
  WHERE child_id IS NOT NULL AND status IN ('waitlist', 'pending', 'confirmed');
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup
  ON notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
