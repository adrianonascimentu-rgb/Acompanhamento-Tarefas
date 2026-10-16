-- ==============================================================================
-- MIGRATION: RLS Security Review & Optimization (Leads, Deliveries, Tasks)
-- Resolve Erro 42P17 (infinite recursion) e implementa padrão Multi-Tenant.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GARANTIR COLUNAS DE TENANT (COMPANY_ID)
-- ------------------------------------------------------------------------------

DO $$ 
BEGIN
    -- Leads
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='company_id') THEN
        ALTER TABLE leads ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
    
    -- Deliveries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='company_id') THEN
        ALTER TABLE deliveries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
    
    -- Tasks (Geralmente já tem em migrações anteriores, mas garantimos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='company_id') THEN
        ALTER TABLE tasks ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. FUNÇÕES SECURITY DEFINER (FIX RECURSION)
-- ------------------------------------------------------------------------------

-- 2.1 Obter Company ID sem recursão
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- Nota: SECURITY DEFINER faz com que a query ignore as políticas de RLS da 'profiles'
  -- desde que o dono da função tenha privilégios para ler a tabela.
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2.2 Verificar Admin/Gerente sem recursão
CREATE OR REPLACE FUNCTION public.is_auth_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (
      LOWER(type) IN ('admin', 'gerente', 'supervisor')
      OR LOWER(role) ILIKE '%admin%'
      OR LOWER(role) ILIKE '%gerente%'
      OR LOWER(role) ILIKE '%supervisor%'
    )
  );
$$;

-- ------------------------------------------------------------------------------
-- 3. PADRÃO OTIMIZADO DE RLS (MULTI-TENANT)
-- ------------------------------------------------------------------------------

-- Função para aplicar RLS padrão a uma tabela
CREATE OR REPLACE FUNCTION public.apply_standard_rls(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
    
    -- Remover políticas existentes
    EXECUTE format('
        DO $pol$
        DECLARE r RECORD;
        BEGIN
            FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = %L AND schemaname = %L) LOOP
                EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', r.policyname, %L);
            END LOOP;
        END $pol$;
    ', p_table, 'public', p_table);

    -- 1. SELECT: Dono, Atribuído, Mesma Empresa ou Admin
    -- Nota: Usamos as funções SECURITY DEFINER para evitar recursão
    EXECUTE format('
        CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (
            (company_id = public.get_auth_company_id())
            OR (public.is_auth_admin())
            OR (id::text IN (SELECT auth.uid()::text)) -- Caso de auto-leitura (ex: profiles)
        );
    ', p_table || '_select', p_table);

    -- 2. INSERT: Deve pertencer à empresa do usuário
    EXECUTE format('
        CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
        WITH CHECK (
            (company_id = public.get_auth_company_id())
            OR (public.is_auth_admin())
        );
    ', p_table || '_insert', p_table);

    -- 3. UPDATE: Mesma empresa ou Admin
    EXECUTE format('
        CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
        USING (
            (company_id = public.get_auth_company_id())
            OR (public.is_auth_admin())
        );
    ', p_table || '_update', p_table);

    -- 4. DELETE: Somente Admin ou Gerente
    EXECUTE format('
        CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
        USING (public.is_auth_admin());
    ', p_table || '_delete', p_table);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. APLICAÇÃO NAS TABELAS CRÍTICAS
-- ------------------------------------------------------------------------------

SELECT public.apply_standard_rls('leads');
SELECT public.apply_standard_rls('tasks');
SELECT public.apply_standard_rls('deliveries');

-- ------------------------------------------------------------------------------
-- 5. REFINAMENTO PARA 'TASKS' (PRECISA VER SE É ATRIBUÍDO)
-- ------------------------------------------------------------------------------
-- Tasks tem uma regra extra: o usuário deve ver se estiver na task_assignees
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    OR public.is_auth_admin()
    OR EXISTS (
        SELECT 1 FROM task_assignees 
        WHERE task_id = tasks.id AND profile_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 6. REFINAMENTO PARA 'PROFILES' (EVITAR RECURSÃO)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "profiles_select_v2" ON public.profiles FOR SELECT TO authenticated
USING (
    company_id = public.get_auth_company_id()
    OR id = auth.uid()
    OR public.is_auth_admin()
);

CREATE POLICY "profiles_update_v2" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_auth_admin());

-- ------------------------------------------------------------------------------
-- 7. ÍNDICES DE PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_company_id ON public.deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- ------------------------------------------------------------------------------
-- 8. LIMPEZA
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.apply_standard_rls(TEXT);

NOTIFY pgrst, 'reload schema';
