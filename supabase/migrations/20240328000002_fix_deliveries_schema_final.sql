-- Comprehensive migration to fix all missing columns in deliveries table
DO $$ 
BEGIN
    -- lat
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='lat') THEN
        ALTER TABLE deliveries ADD COLUMN lat DOUBLE PRECISION;
    END IF;
    
    -- lng
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='lng') THEN
        ALTER TABLE deliveries ADD COLUMN lng DOUBLE PRECISION;
    END IF;
    
    -- route
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='route') THEN
        ALTER TABLE deliveries ADD COLUMN route JSONB DEFAULT '[]';
    END IF;
    
    -- phone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='phone') THEN
        ALTER TABLE deliveries ADD COLUMN phone TEXT;
    END IF;
    
    -- address
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='address') THEN
        ALTER TABLE deliveries ADD COLUMN address TEXT;
    END IF;
    
    -- notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='notes') THEN
        ALTER TABLE deliveries ADD COLUMN notes TEXT;
    END IF;

    -- seller (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='seller') THEN
        ALTER TABLE deliveries ADD COLUMN seller TEXT;
    END IF;
END $$;
