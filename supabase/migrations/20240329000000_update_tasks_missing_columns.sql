-- Add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'Outros';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS origin_demand_id UUID REFERENCES demands(id) ON DELETE SET NULL;

-- Add missing columns to demands table
ALTER TABLE demands ADD COLUMN IF NOT EXISTS origin_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- Ensure these columns have correct constraints if they already existed without them
DO $$ 
BEGIN
    -- Check if origin_demand_id exists and add foreign key if missing
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='origin_demand_id') THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
            WHERE tc.table_name = 'tasks' AND kcu.column_name = 'origin_demand_id' AND tc.constraint_type = 'FOREIGN KEY'
        ) THEN
            ALTER TABLE tasks ADD CONSTRAINT fk_tasks_origin_demand FOREIGN KEY (origin_demand_id) REFERENCES demands(id) ON DELETE SET NULL;
        END IF;
    END IF;

    -- Check if origin_task_id exists and add foreign key if missing
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='demands' AND column_name='origin_task_id') THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
            WHERE tc.table_name = 'demands' AND kcu.column_name = 'origin_task_id' AND tc.constraint_type = 'FOREIGN KEY'
        ) THEN
            ALTER TABLE demands ADD CONSTRAINT fk_demands_origin_task FOREIGN KEY (origin_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
