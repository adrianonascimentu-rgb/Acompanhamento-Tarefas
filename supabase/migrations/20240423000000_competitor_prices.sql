-- ==============================================================================
-- MIGRATION: Tabela de Pesquisa de Preço do Concorrente (competitor_prices)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS competitor_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  product_code TEXT,
  product_name TEXT,
  full_price NUMERIC(10, 2),
  cash_price NUMERIC(10, 2),
  store_name TEXT
);

-- Ativar RLS
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Permitir leitura de pesquisas de preço" ON competitor_prices;
CREATE POLICY "Permitir leitura de pesquisas de preço" ON competitor_prices FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Permitir inserção de pesquisas de preço" ON competitor_prices;
CREATE POLICY "Permitir inserção de pesquisas de preço" ON competitor_prices FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir exclusão de pesquisas de preço" ON competitor_prices;
CREATE POLICY "Permitir exclusão de pesquisas de preço" ON competitor_prices FOR DELETE TO authenticated USING (true);

-- Índices de Desempenho
CREATE INDEX IF NOT EXISTS idx_competitor_prices_created_at ON competitor_prices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_product_code ON competitor_prices(product_code);
CREATE INDEX IF NOT EXISTS idx_competitor_prices_store_name ON competitor_prices(store_name);

-- Recarregar cache de esquema do PostgREST
NOTIFY pgrst, 'reload schema';
