-- ==============================================================================
-- MIGRATION: Proposta de RLS Otimizada e Multi-Tenant (Gold Standard)
-- Objetivo: Garantir isolamento total por empresa e eliminar recursão infinita.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ESTRUTURA DE TENANT (COMPANIES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS na tabela de empresas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Garantir coluna company_id em todas as tabelas operacionais
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÕES DE APOIO (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- 2.1 Obter o Tenant ID (Company) do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- Fallback para garantir que buscamos na tabela física sem RLS interceptar
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2.2 Verificar se o usuário é Administrador Geral do Sistema
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (type = 'admin' OR email = 'adrianonascimentu@gmail.com')
    );
$$;

-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS RLS OTIMIZADAS PARA 'COMPANIES'
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_company" ON public.companies;
CREATE POLICY "select_own_company" ON public.companies
    FOR SELECT
    TO authenticated
    USING (id = public.get_my_tenant_id() OR public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS OTIMIZADAS PARA 'PROFILES'
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas conflitantes
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- 4.1 SELECT: Ver a si mesmo ou colegas da mesma empresa
CREATE POLICY "profiles_isolation_select" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_my_tenant_id() OR id = auth.uid() OR public.is_super_admin());

-- 4.2 INSERT: Somente via trigger de Auth (geralmente) ou Admin
CREATE POLICY "profiles_isolation_insert" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin() OR id = auth.uid());

-- 4.3 UPDATE: Somente o próprio ou Admin
CREATE POLICY "profiles_isolation_update" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR public.is_super_admin())
    WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 5. POLÍTICA GENÉRICA PARA TABELAS OPERACIONAIS (TASKS, LEADS, etc)
-- Proposta de padrão: Toda tabela operacional DEVE ter company_id.
-- ------------------------------------------------------------------------------

-- Exemplo: TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_isolation_policy" ON public.tasks;
CREATE POLICY "tasks_isolation_policy" ON public.tasks
    FOR ALL
    TO authenticated
    USING (company_id = public.get_my_tenant_id() OR public.is_super_admin())
    WITH CHECK (company_id = public.get_my_tenant_id() OR public.is_super_admin());

-- ------------------------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE (VITAL PARA RLS RÁPIDO)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_lookup ON public.profiles (id, company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_lookup ON public.tasks (company_id);

-- Recarregar cache de esquema
NOTIFY pgrst, 'reload schema';
