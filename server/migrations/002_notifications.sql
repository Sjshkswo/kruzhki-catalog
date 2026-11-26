-- Up Migration
-- Отдельная миграция уведомлений (используется API и фоновыми задачами).
CREATE TABLE notifications (
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

CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_notifications_dedup
  ON notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- Down Migration
-- Уведомления сохраняются; автоматический откат не выполняется.
