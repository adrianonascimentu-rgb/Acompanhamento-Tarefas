-- Migration: Fix infinite recursion in profiles RLS policy
-- Error 42P17: infinite recursion detected in policy for relation "profiles"
--
-- Causa: Uma ou mais políticas RLS na tabela `profiles` realizam subconsultas
-- na própria tabela `profiles` (ex: SELECT 1 FROM profiles ...).
-- Solução:
-- 1. Remove TODAS as políticas antigas da tabela profiles de forma dinâmica.
-- 2. Cria função SECURITY DEFINER para verificar permissões sem disparar RLS recursivo.
-- 3. Recria políticas limpas e seguras.

-- 1. Cria a função SECURITY DEFINER que executa isolada de RLS
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

GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(UUID) TO authenticated, anon;

-- 2. Remove DINAMICAMENTE todas as políticas existentes na tabela profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    END LOOP;
END $$;

-- 3. Garante que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 4. Política de Leitura: Pública e transparente (elimina 100% de recursão em SELECT)
CREATE POLICY "profiles_select_policy"
ON profiles FOR SELECT
TO authenticated, anon
USING (true);

-- 5. Política de Inserção: Permitida para criação de usuários e colaboradores
CREATE POLICY "profiles_insert_policy"
ON profiles FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- 6. Política de Atualização: Próprio usuário ou Administrador/Gerente via função segura
CREATE POLICY "profiles_update_policy"
ON profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
)
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
);

-- 7. Política de Exclusão: Próprio usuário ou Administrador/Gerente
CREATE POLICY "profiles_delete_policy"
ON profiles FOR DELETE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
);
