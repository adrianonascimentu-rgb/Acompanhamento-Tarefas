-- Migration: Habilita Row Level Security (RLS) e Políticas de Acesso (Policies)

-- 1. Ativa a segurança em nível de linha nas tabelas principais
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- Regras para a tabela PROFILES
-- -------------------------------------------------------------

-- Remove políticas anteriores para evitar duplicidade
DROP POLICY IF EXISTS "Permitir leitura de perfis para autenticados" ON profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis" ON profiles;
DROP POLICY IF EXISTS "Permitir atualização do próprio perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir atualização de perfil" ON profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON profiles;

-- Regra 1: Leitura de perfis (permite autenticados e anon para lookup de login por username)
CREATE POLICY "Permitir leitura de perfis"
ON profiles FOR SELECT
TO authenticated, anon
USING (true);

-- Regra 2: Inserção de perfil (necessário para cadastro de novos colaboradores)
CREATE POLICY "Permitir inserção de perfil"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Regra 3: Atualização de perfil (o próprio usuário ou administradores via função isolada)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = user_id 
      AND (type = 'admin' OR role ILIKE '%admin%' OR role ILIKE '%gerente%')
  );
$$;

CREATE POLICY "Permitir atualização de perfil"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
)
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
);

-- -------------------------------------------------------------
-- Regras para a tabela SYSTEM_SETTINGS
-- -------------------------------------------------------------

-- Remove políticas anteriores
DROP POLICY IF EXISTS "Permitir leitura de configurações" ON system_settings;
DROP POLICY IF EXISTS "Permitir gravação de configurações para administradores" ON system_settings;

-- Regra 1: Leitura de configurações para usuários autenticados e login
CREATE POLICY "Permitir leitura de configurações"
ON system_settings FOR SELECT
TO authenticated, anon
USING (true);

-- Regra 2: Gravação/atualização de configurações (apenas administradores ou autenticados)
CREATE POLICY "Permitir gravação de configurações para administradores"
ON system_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
