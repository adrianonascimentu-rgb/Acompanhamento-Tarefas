-- Migration to update tasks priority constraint and ensure task_assignees exists

-- 1. Update tasks priority constraint
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
    
    -- Add new constraint including 'Urgente'
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('Alta', 'Média', 'Baixa', 'Urgente'));
END $$;

-- 2. Ensure task_assignees table exists
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(task_id, profile_id)
);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on task_assignees') THEN
        CREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
