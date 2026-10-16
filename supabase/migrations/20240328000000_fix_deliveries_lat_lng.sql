-- Migration to fix missing lat/lng columns in deliveries table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='lat') THEN
        ALTER TABLE deliveries ADD COLUMN lat DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='lng') THEN
        ALTER TABLE deliveries ADD COLUMN lng DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='route') THEN
        ALTER TABLE deliveries ADD COLUMN route JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='phone') THEN
        ALTER TABLE deliveries ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='address') THEN
        ALTER TABLE deliveries ADD COLUMN address TEXT;
    END IF;
END $$;
