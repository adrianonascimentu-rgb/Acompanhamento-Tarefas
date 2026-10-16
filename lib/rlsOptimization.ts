/**
 * Script SQL de Otimização e Prevenção de Recursão Infinita RLS (Erro 42P17)
 * 
 * Regra Arquitetural do PostgreSQL / Supabase:
 * Para evitar que consultas na tabela `profiles` gerem loop quando uma política
 * tenta ler `profiles` para descobrir a empresa ou papel do usuário, a função
 * de verificação deve ser declarada como:
 * 1. SECURITY DEFINER (executa com privilégios do criador ignorando RLS interno da função)
 * 2. STABLE / PARALLEL SAFE
 * 3. SET search_path = public, pg_temp (proteção contra search_path hijacking)
 */

export const OPTIMIZED_RLS_FIX_SQL = `-- =========================================================================
-- SCRIPT DE CORREÇÃO E OTIMIZAÇÃO RLS (SEM RECURSÃO INFINITA - ERRO 42P17)
-- =========================================================================

-- 1. Criação / Garantia da Tabela de Empresas (Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Garantir coluna company_id em todas as tabelas operacionais
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE IF EXISTS public.tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.task_assignees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.transfers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.deliveries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.warranties ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.demands ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.sales_results ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS public.system_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. FUNÇÕES SECURITY DEFINER ANTI-RECURSÃO (Bypass RLS no momento da verificação)

-- Função para obter a Empresa do Usuário sem disparar as políticas de profiles
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Função para verificar se o usuário é Administrador sem disparar loop de RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'admin' OR email = 'admin@agentex.com')
  );
$$;

-- 4. ÍNDICES DE ALTA PERFORMANCE PARA VERIFICAÇÕES DE RLS
CREATE INDEX IF NOT EXISTS idx_profiles_id_company ON public.profiles(id, company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_transfers_company_id ON public.transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_company_id ON public.deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_warranties_company_id ON public.warranties(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_demands_company_id ON public.demands(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON public.notifications(profile_id);

-- 5. APLICAÇÃO DAS POLÍTICAS RLS ROBUSTAS (DESACOPLADAS E LIVRES DE RECURSÃO)

-- PROFILES (Cada usuário gerencia seu próprio perfil ou vê colegas da mesma empresa)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
DROP POLICY IF EXISTS "profiles_company_access" ON public.profiles;
DROP POLICY IF EXISTS "Isolamento de perfis por empresa" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT
USING (
  id = auth.uid() 
  OR company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE
USING (
  id = auth.uid() 
  OR public.is_admin()
);

CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT
WITH CHECK (
  id = auth.uid() 
  OR public.is_admin()
);

-- TASKS (Isolamento por Tenant sem subquery direta recursiva)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_company_isolation" ON public.tasks;
DROP POLICY IF EXISTS "Isolamento de tarefas por empresa" ON public.tasks;

CREATE POLICY "tasks_company_isolation" ON public.tasks FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- TRANSFERS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transfers_company_isolation" ON public.transfers;
DROP POLICY IF EXISTS "Isolamento de transferencias por empresa" ON public.transfers;

CREATE POLICY "transfers_company_isolation" ON public.transfers FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- DELIVERIES
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deliveries_company_isolation" ON public.deliveries;
DROP POLICY IF EXISTS "Isolamento de entregas por empresa" ON public.deliveries;

CREATE POLICY "deliveries_company_isolation" ON public.deliveries FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- WARRANTIES
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "warranties_company_isolation" ON public.warranties;
DROP POLICY IF EXISTS "Isolamento de garantias por empresa" ON public.warranties;

CREATE POLICY "warranties_company_isolation" ON public.warranties FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_company_isolation" ON public.leads;
DROP POLICY IF EXISTS "Isolamento de leads por empresa" ON public.leads;

CREATE POLICY "leads_company_isolation" ON public.leads FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- DEMANDS
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demands_company_isolation" ON public.demands;
DROP POLICY IF EXISTS "Isolamento de demandas por empresa" ON public.demands;

CREATE POLICY "demands_company_isolation" ON public.demands FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- SYSTEM SETTINGS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_settings_isolation" ON public.system_settings;
DROP POLICY IF EXISTS "Isolamento de configuracoes por empresa" ON public.system_settings;

CREATE POLICY "system_settings_isolation" ON public.system_settings FOR ALL
USING (
  company_id IS NULL 
  OR company_id = public.get_user_company_id()
  OR public.is_admin()
);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_user_isolation" ON public.notifications;

CREATE POLICY "notifications_user_isolation" ON public.notifications FOR ALL
USING (
  profile_id = auth.uid() 
  OR public.is_admin()
);

-- RECARREGAR SCHEMA NO POSTGREST
NOTIFY pgrst, 'reload schema';
`;
