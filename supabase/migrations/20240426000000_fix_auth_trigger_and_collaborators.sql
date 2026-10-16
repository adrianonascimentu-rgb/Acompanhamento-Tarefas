-- ==============================================================================
-- MIGRATION: Correção do Trigger Supabase Auth e Restrições de Colaboradores
-- ==============================================================================

-- 1. Remove o trigger antigo que falhava ao tentar inserir colunas inexistentes na tabela profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Garante a existência de colunas complementares para máxima compatibilidade
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- 3. Remove a chave estrangeira restritiva 'fk_auth_user' para permitir cadastro flexível de colaboradores
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_auth_user;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 4. Recria a função de sincronização do Supabase Auth com a tabela public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    username,
    type,
    role,
    phone,
    image_url,
    status,
    active,
    must_change_password,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(
      CASE 
        WHEN LOWER(NEW.raw_user_meta_data->>'type') IN ('admin', 'user', 'vendedor', 'entregador', 'estoque', 'gerente', 'supervisor') 
        THEN LOWER(NEW.raw_user_meta_data->>'type') 
        ELSE 'user' 
      END, 
      'user'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Colaborador'),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'image_url'),
    'Ativo',
    true,
    false,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    type = COALESCE(public.profiles.type, EXCLUDED.type);

  RETURN NEW;
END;
$$;

-- 5. Ativa o trigger limpo e compatível em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Permissões de execução
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres, authenticated, anon;

-- 7. Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
