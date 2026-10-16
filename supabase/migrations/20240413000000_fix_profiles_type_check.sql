-- Migration to fix profiles type check constraint
-- This allows roles like entregador, estoque, gerente, and supervisor to be inserted into profiles.

-- 1. Drop existing constraint if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;

-- 2. Add the updated constraint with all valid roles/types
ALTER TABLE profiles ADD CONSTRAINT profiles_type_check CHECK (type IN ('admin', 'user', 'vendedor', 'entregador', 'estoque', 'gerente', 'supervisor'));
