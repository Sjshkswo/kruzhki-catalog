-- Up Migration
-- Первая версия схемы. Без DROP: безопасно запускать повторно и на уже созданной базе версии 1.0.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  role          VARCHAR(20) NOT NULL DEFAULT 'participant'
                CHECK (role IN ('participant', 'organizer', 'admin')),
  is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS clubs (
  id           SERIAL PRIMARY KEY,
  organizer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INT NOT NULL REFERENCES categories(id),
  title        VARCHAR(150) NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  age_min      INT NOT NULL DEFAULT 5 CHECK (age_min >= 0),
  age_max      INT NOT NULL DEFAULT 18 CHECK (age_max >= age_min),
  price        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  address      VARCHAR(255) NOT NULL DEFAULT '',
  capacity     INT NOT NULL DEFAULT 10 CHECK (capacity > 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schedules (
  id         SERIAL PRIMARY KEY,
  club_id    INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  weekday    INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS registrations (
  id                     SERIAL PRIMARY KEY,
  user_id                INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id                INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  participant_name       VARCHAR(100) NOT NULL,
  participant_birth_year INT NOT NULL,
  phone                  VARCHAR(20) NOT NULL,
  comment                TEXT,
  status                 VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Запрет повторной активной заявки на один кружок для того же участника
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_registration
  ON registrations (club_id, user_id, participant_name)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category_id);
CREATE INDEX IF NOT EXISTS idx_registrations_club ON registrations(club_id);

-- Down Migration
DROP TABLE IF EXISTS registrations, schedules, clubs, categories, users CASCADE;
