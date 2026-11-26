-- Перевод аккаунтов на вход по телефону и удаление email из учётных данных.
UPDATE users
SET phone = '+' || regexp_replace(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    WHERE phone IS NULL OR phone !~ '^\+[1-9][0-9]{6,14}$'
  ) THEN
    RAISE EXCEPTION 'Перед миграцией 003 каждому аккаунту нужен действительный телефон в международном формате';
  END IF;

  IF EXISTS (SELECT phone FROM users GROUP BY phone HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Перед миграцией 003 телефоны аккаунтов должны быть уникальными';
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
CREATE UNIQUE INDEX users_phone_unique ON users(phone);
ALTER TABLE users DROP COLUMN email;
