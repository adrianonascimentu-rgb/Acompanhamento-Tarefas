-- =======================================================
-- ARQUITETURA SAAS MULTI-TENANT PARA SUPABASE (RLS)
-- Utiliza Função SECURITY DEFINER para EVITAR RECURSÃO INFINITA (Erro 42P17)
-- =======================================================

-- -------------------------------------------------------
-- ETAPA 1: Criar tabela de Empresas (Tenants)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'active', -- Ex: active, trial, canceled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -------------------------------------------------------
-- ETAPA 2: Adicionar coluna company_id em TODAS as tabelas
-- -------------------------------------------------------

ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS system_settings ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS deliveries ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS transfers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS warranties ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS sales_results ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS drivers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- -------------------------------------------------------
-- ETAPA 3: Função SECURITY DEFINER para evitar recursão infinita no RLS
-- (Esta função busca o company_id do usuário ignorando RLS para quebrar o loop)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- -------------------------------------------------------
-- ETAPA 4: Ativar RLS e Criar Políticas por Empresa Sem Recursão
-- -------------------------------------------------------

-- Tabela Companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários visualizam sua própria empresa" ON companies;
CREATE POLICY "Usuários visualizam sua própria empresa" ON companies FOR SELECT
USING (id = get_user_company_id());

-- Tabela Profiles (O usuário sempre pode ver o próprio perfil OU perfis da mesma empresa)
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Isolamento de perfis por empresa" ON profiles;
CREATE POLICY "Isolamento de perfis por empresa" ON profiles FOR ALL
USING (
  id = auth.uid() OR company_id IS NULL OR company_id = get_user_company_id()
);

-- Tabela Tasks
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de tarefas por empresa" ON tasks;
    CREATE POLICY "Isolamento de tarefas por empresa" ON tasks FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela System Settings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
    ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de configuracoes por empresa" ON system_settings;
    CREATE POLICY "Isolamento de configuracoes por empresa" ON system_settings FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Deliveries
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
    ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de entregas por empresa" ON deliveries;
    CREATE POLICY "Isolamento de entregas por empresa" ON deliveries FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Transfers
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transfers') THEN
    ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de transferencias por empresa" ON transfers;
    CREATE POLICY "Isolamento de transferencias por empresa" ON transfers FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Warranties
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warranties') THEN
    ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de garantias por empresa" ON warranties;
    CREATE POLICY "Isolamento de garantias por empresa" ON warranties FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Leads
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de leads por empresa" ON leads;
    CREATE POLICY "Isolamento de leads por empresa" ON leads FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Sales Results
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_results') THEN
    ALTER TABLE sales_results ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de resultados de vendas por empresa" ON sales_results;
    CREATE POLICY "Isolamento de resultados de vendas por empresa" ON sales_results FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- Tabela Demands
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'demands') THEN
    ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Isolamento de demandas por empresa" ON demands;
    CREATE POLICY "Isolamento de demandas por empresa" ON demands FOR ALL
    USING (company_id IS NULL OR company_id = get_user_company_id());
  END IF;
END $$;

-- -------------------------------------------------------
-- ETAPA 5: Criar Índices de Desempenho
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_transfers_company ON transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_warranties_company ON warranties(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_results_company ON sales_results(company_id);
CREATE INDEX IF NOT EXISTS idx_demands_company ON demands(company_id);

-- Recarregar cache de esquema no PostgREST
NOTIFY pgrst, 'reload schema';
