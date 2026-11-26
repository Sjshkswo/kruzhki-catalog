-- Kruzhki Catalog v2.1: Добавление роли 'manager' (Управляющий)
-- Управляющий имеет высшие полномочия: снятие/назначение прав администратора, аудит и контроль.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('parent', 'organizer', 'admin', 'manager'));
