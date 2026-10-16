-- =============================================================
-- CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS) NA TABELA 'TASKS'
-- Corrigido para utilizar 'profile_id' em 'task_assignees'
-- =============================================================

-- 1. Habilitar RLS na tabela de tarefas
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 2. Garantir existência das colunas necessárias para vinculação de usuários em 'tasks'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Garantir criação e habilitação RLS na tabela de atribuições múltiplas 'task_assignees'
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(task_id, profile_id)
);

ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas anteriores para evitar conflitos de duplicação
DROP POLICY IF EXISTS "Usuários podem ver tarefas atribuídas ou criadas por eles" ON tasks;
DROP POLICY IF EXISTS "Usuários podem visualizar tarefas atribuídas ou criadas por eles" ON tasks;
DROP POLICY IF EXISTS "Permitir leitura de tarefas autorizadas" ON tasks;
DROP POLICY IF EXISTS "Permitir inserção de tarefas por usuários autenticados" ON tasks;
DROP POLICY IF EXISTS "Permitir atualização de tarefas por responsáveis ou criadores" ON tasks;
DROP POLICY IF EXISTS "Permitir exclusão de tarefas por criadores ou admins" ON tasks;
DROP POLICY IF EXISTS "Admins possuem acesso total a tarefas" ON tasks;

DROP POLICY IF EXISTS "Permitir leitura de atribuições" ON task_assignees;
DROP POLICY IF EXISTS "Permitir inserção de atribuições" ON task_assignees;
DROP POLICY IF EXISTS "Permitir exclusão de atribuições" ON task_assignees;

-- 5. POLÍTICAS DA TABELA TASK_ASSIGNEES
CREATE POLICY "Permitir leitura de atribuições" ON task_assignees
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserção de atribuições" ON task_assignees
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir exclusão de atribuições" ON task_assignees
FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 6. POLÍTICA DE LEITURA (SELECT) NA TABELA TASKS
CREATE POLICY "Permitir leitura de tarefas autorizadas" ON tasks
FOR SELECT
TO authenticated
USING (
  assigned_to = auth.uid() 
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM task_assignees 
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.type IN ('admin', 'gerente', 'supervisor') OR profiles.role IN ('admin', 'gerente', 'supervisor'))
  )
);

-- 7. POLÍTICA DE INSERÇÃO (INSERT)
CREATE POLICY "Permitir inserção de tarefas por usuários autenticados" ON tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- 8. POLÍTICA DE ATUALIZAÇÃO (UPDATE)
CREATE POLICY "Permitir atualização de tarefas por responsáveis ou criadores" ON tasks
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid() 
  OR collaborator_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM task_assignees 
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.type IN ('admin', 'gerente', 'supervisor') OR profiles.role IN ('admin', 'gerente', 'supervisor'))
  )
);

-- 9. POLÍTICA DE EXCLUSÃO (DELETE)
CREATE POLICY "Permitir exclusão de tarefas por criadores ou admins" ON tasks
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR collaborator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.type IN ('admin', 'gerente', 'supervisor') OR profiles.role IN ('admin', 'gerente', 'supervisor'))
  )
);

-- 10. Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
