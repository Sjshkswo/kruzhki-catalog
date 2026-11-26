-- Up Migration
-- Итоговая схема проекта для новой локальной базы.
-- Все итоговые поля и ограничения задаются сразу в CREATE TABLE.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL DEFAULT 'parent'
    CHECK (role IN ('parent', 'organizer', 'admin')),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at TIMESTAMPTZ,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE clubs (
  id SERIAL PRIMARY KEY,
  organizer_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  age_min INT NOT NULL DEFAULT 5 CHECK (age_min >= 0),
  age_max INT NOT NULL DEFAULT 18 CHECK (age_max >= age_min),
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  price_period VARCHAR(10) NOT NULL DEFAULT 'month'
    CHECK (price_period IN ('lesson', 'month', 'course', 'free')),
  address VARCHAR(255) NOT NULL DEFAULT '',
  capacity INT NOT NULL DEFAULT 10 CHECK (capacity > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (moderation_status IN ('pending_review', 'approved', 'rejected', 'blocked')),
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

CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time)
);

CREATE TABLE children (
  id SERIAL PRIMARY KEY,
  parent_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  full_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL CHECK (birth_date > DATE '1920-01-01'),
  gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('male', 'female')),
  consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  child_id INT REFERENCES children(id) ON DELETE RESTRICT,
  -- Снимок данных ребёнка для истории и существующих экранов заявок.
  participant_name VARCHAR(100) NOT NULL,
  participant_birth_year INT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  comment TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'waitlist', 'pending', 'confirmed', 'rejected', 'removed', 'expired',
      'cancelled', 'cancelled_by_organizer', 'cancelled_by_system'
    )),
  waitlist_position INT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organizer_applications (
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

CREATE TABLE club_photos (
  id SERIAL PRIMARY KEY,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  stored_name VARCHAR(100) NOT NULL UNIQUE,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE registration_history (
  id SERIAL PRIMARY KEY,
  registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_log (
  id SERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id INT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
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

CREATE TABLE favorites (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, club_id)
);

CREATE INDEX idx_clubs_category ON clubs(category_id);
CREATE INDEX idx_clubs_moderation ON clubs(moderation_status, is_active);
CREATE INDEX idx_clubs_district ON clubs(district);
CREATE INDEX idx_registrations_club ON registrations(club_id);
CREATE INDEX idx_registrations_club_status ON registrations(club_id, status);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_children_parent ON children(parent_id);
CREATE INDEX idx_registration_history_registration ON registration_history(registration_id);
CREATE UNIQUE INDEX uq_pending_application
  ON organizer_applications(user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX uq_active_child
  ON registrations(club_id, child_id)
  WHERE status IN ('waitlist', 'pending', 'confirmed');

-- Down Migration
-- Миграция начальной схемы намеренно не откатывается автоматически.
