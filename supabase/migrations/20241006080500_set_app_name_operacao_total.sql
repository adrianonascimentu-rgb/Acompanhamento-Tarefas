-- Migration: Atualizar nome do aplicativo na base de dados para "Operação Total / Gestão Inteligente"

-- 1. Assegurar tabela system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar RLS e política permissiva se ainda não existirem
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow all on system_settings') THEN
        CREATE POLICY "Allow all on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 2. Atualizar ou inserir as chaves de configuração do nome da aplicação
INSERT INTO public.system_settings (key, value, updated_at)
VALUES 
  ('app_name', '"Operação Total / Gestão Inteligente"'::jsonb, NOW()),
  ('app_short_name', '"Operação Total"'::jsonb),
  ('app_subtitle', '"Gestão Inteligente"'::jsonb),
  ('system_name', '"Operação Total / Gestão Inteligente"'::jsonb),
  ('company_name', '"Operação Total / Gestão Inteligente"'::jsonb)
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- 3. Atualizar tabela de empresas (companies) caso exista
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        UPDATE public.companies 
        SET name = 'Operação Total / Gestão Inteligente'
        WHERE id IS NOT NULL;
    END IF;
END $$;

-- Notificar PostgREST para recarregar o cache
NOTIFY pgrst, 'reload schema';
