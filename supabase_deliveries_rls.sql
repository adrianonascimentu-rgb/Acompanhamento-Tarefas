-- =============================================================
-- CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS) NA TABELA 'DELIVERIES'
-- Garantia de Privacidade e Acesso: Colaboradores e entregadores
-- só visualizam e editam as entregas que lhes foram atribuídas
-- (courier_id, driver_id, collaborator_id ou created_by), enquanto
-- administradores e gerentes possuem acesso total.
-- =============================================================

-- 1. Habilitar RLS na tabela de entregas
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- 2. Garantir a existência das colunas chaves de vinculação de usuário/entregador
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Remover políticas antigas/existentes para evitar conflitos
DROP POLICY IF EXISTS "Permitir leitura de entregas autorizadas" ON deliveries;
DROP POLICY IF EXISTS "Permitir insercao de entregas por usuarios autenticados" ON deliveries;
DROP POLICY IF EXISTS "Permitir atualizacao de entregas por entregadores ou admins" ON deliveries;
DROP POLICY IF EXISTS "Permitir exclusao de entregas por criadores ou admins" ON deliveries;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias entregas" ON deliveries;
DROP POLICY IF EXISTS "Isolamento de entregas por empresa" ON deliveries;

-- 4. POLÍTICA DE LEITURA (SELECT)
-- Entregadores/colaboradores só visualizam entregas atribuídas a eles (ou criadas por eles)
-- Administradores, gerentes e supervisores possuem acesso irrestrito
CREATE POLICY "Permitir leitura de entregas autorizadas" ON deliveries
FOR SELECT
TO authenticated
USING (
  courier_id = auth.uid()
  OR driver_id = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.type IN ('admin', 'gerente', 'supervisor') 
      OR profiles.role IN ('admin', 'gerente', 'supervisor')
    )
  )
);

-- 5. POLÍTICA DE INSERÇÃO (INSERT)
-- Permite que colaboradores e administradores autenticados registrem novas entregas
CREATE POLICY "Permitir insercao de entregas por usuarios autenticados" ON deliveries
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 6. POLÍTICA DE ATUALIZAÇÃO (UPDATE)
-- Permite que entregadores atualizem o status, rota ou notas das entregas atribuídas a eles
CREATE POLICY "Permitir atualizacao de entregas por entregadores ou admins" ON deliveries
FOR UPDATE
TO authenticated
USING (
  courier_id = auth.uid()
  OR driver_id = auth.uid()
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.type IN ('admin', 'gerente', 'supervisor') 
      OR profiles.role IN ('admin', 'gerente', 'supervisor')
    )
  )
);

-- 7. POLÍTICA DE EXCLUSÃO (DELETE)
-- Permite a remoção de entregas apenas por administradores/gerentes ou pelo criador da remessa
CREATE POLICY "Permitir exclusao de entregas por criadores ou admins" ON deliveries
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      profiles.type IN ('admin', 'gerente', 'supervisor') 
      OR profiles.role IN ('admin', 'gerente', 'supervisor')
    )
  )
);

-- 8. Recarregar o cache do schema no Supabase PostgREST
NOTIFY pgrst, 'reload schema';
