-- Up Migration
-- Версия 2.0, этап 1: роль parent, модерация кружков, заявки организаторов, журнал админа,
-- расширенные статусы заявок.

-- 1. Роль participant -> parent
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'parent' WHERE role = 'participant';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('parent', 'organizer', 'admin'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'parent';

-- 2. Модерация кружков (поле видимости админа отделено от is_active организатора)
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
    CHECK (moderation_status IN ('pending_review', 'approved', 'rejected', 'blocked')),
  ADD COLUMN IF NOT EXISTS moderation_comment TEXT;
-- Кружки, созданные до введения модерации, считаются одобренными
UPDATE clubs SET moderation_status = 'approved';

-- 3. Заявки на роль организатора
CREATE TABLE IF NOT EXISTS organizer_applications (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id),
  org_name      VARCHAR(150) NOT NULL,
  bin           VARCHAR(12) NOT NULL CHECK (bin ~ '^[0-9]{12}$'),
  phone         VARCHAR(20) NOT NULL,
  social_url    VARCHAR(255),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Не больше одной заявки в ожидании на пользователя
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_application
  ON organizer_applications (user_id) WHERE status = 'pending';

-- 4. Расширенные статусы заявок (используются по мере внедрения правил R-13 ... R-20)
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check CHECK (status IN
  ('waitlist', 'pending', 'confirmed', 'rejected', 'removed', 'expired',
   'cancelled', 'cancelled_by_organizer', 'cancelled_by_system'));

-- 5. Журнал действий администратора
CREATE TABLE IF NOT EXISTS admin_log (
  id          SERIAL PRIMARY KEY,
  admin_id    INT NOT NULL REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,
  target_type VARCHAR(20),
  target_id   INT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы под фильтры каталога
CREATE INDEX IF NOT EXISTS idx_clubs_moderation ON clubs(moderation_status);

-- Down Migration
DROP TABLE IF EXISTS admin_log;
DROP TABLE IF EXISTS organizer_applications;
DROP INDEX IF EXISTS idx_clubs_moderation;
ALTER TABLE clubs DROP COLUMN IF EXISTS moderation_comment, DROP COLUMN IF EXISTS moderation_status;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
UPDATE registrations SET status = 'cancelled' WHERE status NOT IN ('pending', 'confirmed', 'rejected', 'cancelled');
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled'));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'participant' WHERE role = 'parent';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('participant', 'organizer', 'admin'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'participant';
