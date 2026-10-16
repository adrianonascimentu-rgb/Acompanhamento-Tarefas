-- ==============================================================================
-- MIGRATION: Trigger e Função de Sincronização do Supabase Auth com Profiles
-- ==============================================================================

-- 1. Função que gerencia novos usuários criados no Supabase Auth (auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_username TEXT;
  v_type TEXT;
  v_role TEXT;
  v_company_id UUID;
  v_phone TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Extrair metadados passados durante o cadastro / signUp / admin.createUser
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1));
  v_type := COALESCE(NEW.raw_user_meta_data->>'type', 'collaborator');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'Colaborador');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  -- Tentar extrair company_id se fornecido nos metadados
  IF (NEW.raw_user_meta_data->>'company_id') IS NOT NULL AND (NEW.raw_user_meta_data->>'company_id') != '' THEN
    BEGIN
      v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_company_id := NULL;
    END;
  END IF;

  -- Inserir ou atualizar na tabela public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    name,
    username,
    type,
    role,
    company_id,
    phone,
    avatar_url,
    active,
    must_change_password,
    created_at
  ) VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_username,
    v_type,
    v_role,
    v_company_id,
    v_phone,
    v_avatar_url,
    true,
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::BOOLEAN, false),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    type = COALESCE(public.profiles.type, EXCLUDED.type),
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id);

  RETURN NEW;
END;
$$;

-- 2. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, postgres, authenticated, anon;

-- 3. Criar o Trigger na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Notificar PostgREST
NOTIFY pgrst, 'reload schema';
