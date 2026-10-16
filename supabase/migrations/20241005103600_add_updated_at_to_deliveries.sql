-- Migration to add updated_at column to deliveries
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='updated_at') THEN
        ALTER TABLE deliveries ADD COLUMN updated_at TEXT;
    END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
