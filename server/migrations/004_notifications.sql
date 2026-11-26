CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  dedup_key VARCHAR(100),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup
  ON notifications(user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

