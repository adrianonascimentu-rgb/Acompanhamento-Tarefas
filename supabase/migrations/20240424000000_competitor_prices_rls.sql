-- ==============================================================================
-- MIGRATION: Políticas de RLS Multi-Empresa Otimizadas para competitor_prices
-- ==============================================================================

-- 1. Garantir que as colunas company_id e created_by existam na tabela competitor_prices
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='competitor_prices' AND column_name='company_id') THEN
        ALTER TABLE competitor_prices ADD COLUMN company_id UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='competitor_prices' AND column_name='created_by') THEN
        ALTER TABLE competitor_prices ADD COLUMN created_by UUID;
    END IF;
END $$;

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;

-- 3. Remover apenas as políticas antigas da tabela competitor_prices
DROP POLICY IF EXISTS "Permitir leitura de pesquisas de preço" ON competitor_prices;
DROP POLICY IF EXISTS "Permitir inserção de pesquisas de preço" ON competitor_prices;
DROP POLICY IF EXISTS "Permitir exclusão de pesquisas de preço" ON competitor_prices;
DROP POLICY IF EXISTS "competitor_prices_select_policy" ON competitor_prices;
DROP POLICY IF EXISTS "competitor_prices_insert_policy" ON competitor_prices;
DROP POLICY IF EXISTS "competitor_prices_update_policy" ON competitor_prices;
DROP POLICY IF EXISTS "competitor_prices_delete_policy" ON competitor_prices;

-- 4. Função SECURITY DEFINER Otimizada (STABLE + InitPlan Cache) para buscar a empresa do usuário
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

-- 5. Função SECURITY DEFINER Otimizada para verificação de perfis administrativos
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = user_id 
      AND (
        LOWER(COALESCE(type, '')) IN ('admin', 'gerente', 'supervisor')
        OR LOWER(COALESCE(role, '')) ILIKE '%admin%'
        OR LOWER(COALESCE(role, '')) ILIKE '%gerente%'
        OR LOWER(COALESCE(role, '')) ILIKE '%supervisor%'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_company_id(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(UUID) TO authenticated, anon;

-- 6. POLÍTICA DE LEITURA (SELECT) - OTIMIZADA COM SUB-SELECT (InitPlan)
-- Sub-queries do tipo `(SELECT ...)` são executadas 1 única vez por consulta (InitPlan) em vez de 1 por linha.
CREATE POLICY "competitor_prices_select_policy" ON competitor_prices
FOR SELECT TO authenticated, anon
USING (
  -- Membro da mesma empresa do usuário logado (InitPlan cached)
  company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))
  -- Ou criador direto do registro
  OR created_by = (SELECT auth.uid())
  -- Ou registros globais/públicos sem vinculo de empresa
  OR company_id IS NULL
  -- Ou usuário administrador / gerente (InitPlan cached)
  OR (SELECT public.is_admin_or_manager((SELECT auth.uid())))
);

-- 7. POLÍTICA DE INSERÇÃO (INSERT)
CREATE POLICY "competitor_prices_insert_policy" ON competitor_prices
FOR INSERT TO authenticated, anon
WITH CHECK (true);

-- 8. POLÍTICA DE ATUALIZAÇÃO (UPDATE)
CREATE POLICY "competitor_prices_update_policy" ON competitor_prices
FOR UPDATE TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))
  OR (SELECT public.is_admin_or_manager((SELECT auth.uid())))
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))
  OR (SELECT public.is_admin_or_manager((SELECT auth.uid())))
);

-- 9. POLÍTICA DE EXCLUSÃO (DELETE)
CREATE POLICY "competitor_prices_delete_policy" ON competitor_prices
FOR DELETE TO authenticated
USING (
  created_by = (SELECT auth.uid())
  OR company_id = (SELECT public.get_user_company_id((SELECT auth.uid())))
  OR (SELECT public.is_admin_or_manager((SELECT auth.uid())))
);

-- 10. Índices Compostos e Simples para Otimização de Consultas Multi-Tenant
CREATE INDEX IF NOT EXISTS idx_competitor_prices_company_id ON competitor_prices(company_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_created_by ON competitor_prices(created_by);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_company_created ON competitor_prices(company_id, created_by);

-- 11. Recarregar o cache de esquema do PostgREST
NOTIFY pgrst, 'reload schema';
