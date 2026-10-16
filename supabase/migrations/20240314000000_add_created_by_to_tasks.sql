-- Add created_by column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Update existing tasks to have a default creator (e.g., the first admin)
UPDATE tasks SET created_by = '77777777-7777-7777-7777-777777777777' WHERE created_by IS NULL;
