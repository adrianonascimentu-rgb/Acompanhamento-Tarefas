-- Add created_by column to warranties table and update status options
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update existing records to have a placeholder if needed, but usually not necessary for new features
-- We can also use this opportunity to ensure the status column has a default value if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='warranties' AND column_name='status'
    ) THEN
        ALTER TABLE public.warranties ADD COLUMN status TEXT NOT NULL DEFAULT 'Aberto';
    END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
