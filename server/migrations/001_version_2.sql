-- Kruzhki Catalog v2.0: additive migration, safe to run once via db:init.
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role='parent' WHERE role='participant';
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'parent';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('parent','organizer','admin'));
-- Пользователи блокируются, а не удаляются: сохраняем историю заявок и кружков.
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_organizer_id_fkey;
ALTER TABLE clubs ADD CONSTRAINT clubs_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_user_id_fkey;
ALTER TABLE registrations ADD CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending_review';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS moderation_comment TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS price_period VARCHAR(10) NOT NULL DEFAULT 'month';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS season_start DATE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS season_end DATE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS free_trial BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_whatsapp VARCHAR(20);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS district VARCHAR(50);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS lat NUMERIC(9,6);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS lng NUMERIC(9,6);
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_moderation_status_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_moderation_status_check CHECK (moderation_status IN ('pending_review','approved','rejected','blocked'));
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_price_period_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_price_period_check CHECK (price_period IN ('lesson','month','course','free'));
-- Ранее опубликованные кружки сохраняют видимость; новые кружки создаются pending_review.
UPDATE clubs SET moderation_status='approved' WHERE moderation_status='pending_review';

CREATE TABLE IF NOT EXISTS organizer_applications (
 id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 org_name VARCHAR(150) NOT NULL, bin VARCHAR(12) CHECK (bin IS NULL OR bin ~ '^[0-9]{12}$'),
 phone VARCHAR(20) NOT NULL, social_url VARCHAR(255), status VARCHAR(20) NOT NULL DEFAULT 'pending'
 CHECK(status IN ('pending','approved','rejected')), admin_comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS children (
 id SERIAL PRIMARY KEY, parent_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 full_name VARCHAR(100) NOT NULL, birth_date DATE NOT NULL CHECK (birth_date > DATE '1920-01-01'),
 gender VARCHAR(20), consent_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS club_photos (
 id SERIAL PRIMARY KEY, club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 stored_name VARCHAR(100) NOT NULL UNIQUE, is_cover BOOLEAN NOT NULL DEFAULT FALSE, sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS child_id INT REFERENCES children(id) ON DELETE RESTRICT;
-- Перенос старых текстовых участников в профили детей (дата: 1 января указанного года).
INSERT INTO children(parent_id,full_name,birth_date,consent_at)
SELECT r.user_id,MIN(trim(r.participant_name)),make_date(r.participant_birth_year,1,1),now()
FROM registrations r WHERE NOT EXISTS (SELECT 1 FROM children c WHERE c.parent_id=r.user_id AND lower(trim(c.full_name))=lower(trim(r.participant_name)) AND EXTRACT(YEAR FROM c.birth_date)::int=r.participant_birth_year)
GROUP BY r.user_id,lower(trim(r.participant_name)),r.participant_birth_year;
UPDATE registrations r SET child_id=c.id FROM children c WHERE r.child_id IS NULL AND c.parent_id=r.user_id AND lower(trim(c.full_name))=lower(trim(r.participant_name)) AND EXTRACT(YEAR FROM c.birth_date)::int=r.participant_birth_year;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS waitlist_position INT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_status_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_status_check CHECK(status IN
 ('waitlist','pending','confirmed','rejected','removed','expired','cancelled','cancelled_by_organizer','cancelled_by_system'));
DROP INDEX IF EXISTS uq_active_registration;
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_child ON registrations(club_id,child_id)
 WHERE child_id IS NOT NULL AND status IN ('waitlist','pending','confirmed');
CREATE INDEX IF NOT EXISTS idx_registrations_club_status ON registrations(club_id,status);
CREATE TABLE IF NOT EXISTS registration_history (
 id SERIAL PRIMARY KEY, registration_id INT NOT NULL REFERENCES registrations(id) ON DELETE RESTRICT,
 from_status VARCHAR(30), to_status VARCHAR(30) NOT NULL, changed_by INT REFERENCES users(id) ON DELETE SET NULL,
 reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reviews (
 id SERIAL PRIMARY KEY, club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
 user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 text TEXT NOT NULL CHECK(length(text) BETWEEN 10 AND 1000), organizer_reply TEXT,
 is_hidden BOOLEAN NOT NULL DEFAULT FALSE, moderation_comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(club_id,user_id)
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 club_id INT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE, PRIMARY KEY(user_id,club_id)
);
CREATE TABLE IF NOT EXISTS admin_log (
 id SERIAL PRIMARY KEY, admin_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action VARCHAR(50) NOT NULL, target_type VARCHAR(20), target_id INT, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clubs_moderation ON clubs(moderation_status,is_active);
CREATE INDEX IF NOT EXISTS idx_clubs_district ON clubs(district);
