-- Fix deliveries_driver_id_fkey constraint
-- This migration ensures that the driver_id column in the deliveries table 
-- references the correct drivers table, resolving foreign key violations.

DO $$ 
BEGIN
    -- 1. Drop existing constraint if it exists (it might be pointing to profiles)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'deliveries_driver_id_fkey'
    ) THEN
        ALTER TABLE public.deliveries DROP CONSTRAINT deliveries_driver_id_fkey;
    END IF;

    -- 2. Add the correct constraint pointing to the drivers table
    -- First, ensure the column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'deliveries' AND column_name = 'driver_id'
    ) THEN
        ALTER TABLE public.deliveries ADD COLUMN driver_id UUID;
    END IF;

    -- 3. Add the foreign key constraint
    -- Note: We use NOT VALID to avoid checking existing data that might be broken, 
    -- then we'll validate it if possible, or just leave it as is if it's too risky.
    -- Actually, for a fix like this, it's better to just add it.
    ALTER TABLE public.deliveries 
    ADD CONSTRAINT deliveries_driver_id_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.drivers(id) 
    ON DELETE SET NULL;

END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
