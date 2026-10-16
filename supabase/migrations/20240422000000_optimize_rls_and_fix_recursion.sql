-- ==============================================================================
-- MIGRATION: Otimização de RLS (Row Level Security) & Correção de Recursão Infinita
-- Solução para Erro 42P17 (infinite recursion detected in policy) e gargalos de performance
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PASSO 1: Criar/Atualizar Funções Auxiliares SECURITY DEFINER (Isoladas do RLS)
-- ------------------------------------------------------------------------------

-- 1.1 Função para verificar se o usuário é Admin, Gerente ou Supervisor sem disparar RLS recursivo
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = p_user_id 
      AND (
        LOWER(COALESCE(type, '')) IN ('admin', 'gerente', 'supervisor')
        OR LOWER(COALESCE(role, '')) ILIKE '%admin%'
        OR LOWER(COALESCE(role, '')) ILIKE '%gerente%'
        OR LOWER(COALESCE(role, '')) ILIKE '%supervisor%'
      )
  );
$$;

-- 1.2 Função para obter a empresa (company_id) do usuário sem disparar RLS recursivo
CREATE OR REPLACE FUNCTION public.get_user_company_id(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.profiles 
  WHERE id = p_user_id 
  LIMIT 1;
$$;

-- Conceder permissão de execução das funções
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(UUID) TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- PASSO 2: Otimizar Tabela 'PROFILES'
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- 2.1 Leitura: Permite leitura pública/autenticada para listagens e perfis
CREATE POLICY "profiles_select_policy"
ON public.profiles FOR SELECT
TO authenticated, anon
USING (true);

-- 2.2 Inserção: Permitida para criação de conta
CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- 2.3 Atualização: O próprio usuário ou Administrador/Gerente
CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
)
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
);

-- 2.4 Exclusão: Próprio usuário ou Administrador/Gerente
CREATE POLICY "profiles_delete_policy"
ON public.profiles FOR DELETE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_manager(auth.uid())
);


-- ------------------------------------------------------------------------------
-- PASSO 3: Otimizar Tabela 'TASKS' e 'TASK_ASSIGNEES'
-- ------------------------------------------------------------------------------

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    END LOOP;
END $$;

-- 3.1 Política de Leitura em Tasks
CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR company_id IS NULL 
  OR company_id = public.get_user_company_id(auth.uid())
  OR public.is_admin_or_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_assignees 
    WHERE task_assignees.task_id = tasks.id 
      AND task_assignees.profile_id = auth.uid()
  )
);

-- 3.2 Inserção em Tasks
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 3.3 Atualização em Tasks
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE TO authenticated
USING (
  assigned_to = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin_or_manager(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_assignees 
    WHERE task_assignees.task_id = tasks.id 
      AND task_assignees.profile_id = auth.uid()
  )
);

-- 3.4 Exclusão em Tasks
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin_or_manager(auth.uid())
);

-- Tabela TASK_ASSIGNEES
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'task_assignees' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_assignees', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "task_assignees_select_policy" ON public.task_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_assignees_insert_policy" ON public.task_assignees FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "task_assignees_delete_policy" ON public.task_assignees FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- ------------------------------------------------------------------------------
-- PASSO 4: Otimizar Tabela 'DELIVERIES'
-- ------------------------------------------------------------------------------

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'deliveries' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.deliveries', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "deliveries_select_policy" ON public.deliveries
FOR SELECT TO authenticated
USING (
  courier_id = auth.uid()
  OR driver_id = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR company_id IS NULL
  OR company_id = public.get_user_company_id(auth.uid())
  OR public.is_admin_or_manager(auth.uid())
);

CREATE POLICY "deliveries_insert_policy" ON public.deliveries
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deliveries_update_policy" ON public.deliveries
FOR UPDATE TO authenticated
USING (
  courier_id = auth.uid()
  OR driver_id = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin_or_manager(auth.uid())
);

CREATE POLICY "deliveries_delete_policy" ON public.deliveries
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin_or_manager(auth.uid())
);


-- ------------------------------------------------------------------------------
-- PASSO 5: Otimizar Outras Tabelas do Sistema (Transfers, Warranties, Leads, etc)
-- ------------------------------------------------------------------------------

-- Function utilitária genérica para aplicar RLS padrão por empresa e admin
DO $$
DECLARE
  tbl TEXT;
  tables_list TEXT[] := ARRAY['transfers', 'warranties', 'leads', 'sales_results', 'demands', 'drivers', 'system_settings'];
BEGIN
  FOREACH tbl IN ARRAY tables_list LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      
      -- Drop antigas
      EXECUTE format('
        DO $inner$
        DECLARE pol RECORD;
        BEGIN
          FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = %L AND schemaname = %L) LOOP
            EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', pol.policyname, %L);
          END LOOP;
        END $inner$;
      ', tbl, 'public', tbl);

      -- Criar novas políticas limpas usando funções SECURITY DEFINER
      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
        USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid()) OR public.is_admin_or_manager(auth.uid()));
      ', tbl || '_select_policy', tbl);

      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
        WITH CHECK (auth.uid() IS NOT NULL);
      ', tbl || '_insert_policy', tbl);

      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
        USING (company_id IS NULL OR company_id = public.get_user_company_id(auth.uid()) OR public.is_admin_or_manager(auth.uid()));
      ', tbl || '_update_policy', tbl);

      EXECUTE format('
        CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
        USING (public.is_admin_or_manager(auth.uid()));
      ', tbl || '_delete_policy', tbl);

    END IF;
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- PASSO 6: Criar Índices B-Tree de Alta Performance
-- ------------------------------------------------------------------------------

-- Perfis e Empresas
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_type_role ON public.profiles(type, role);

-- Tarefas
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_collaborator_id ON public.tasks(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);

-- Atribuições de Tarefas
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_profile_id ON public.task_assignees(profile_id);

-- Entregas
CREATE INDEX IF NOT EXISTS idx_deliveries_courier_id ON public.deliveries(courier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON public.deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_collaborator_id ON public.deliveries(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_by ON public.deliveries(created_by);
CREATE INDEX IF NOT EXISTS idx_deliveries_company_id ON public.deliveries(company_id);


-- ------------------------------------------------------------------------------
-- PASSO 7: Recarregar Cache de Esquema no Supabase (PostgREST)
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
