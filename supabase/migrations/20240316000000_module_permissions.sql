-- Add module permission columns to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_leads') THEN
        ALTER TABLE profiles ADD COLUMN can_access_leads BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_deliveries') THEN
        ALTER TABLE profiles ADD COLUMN can_access_deliveries BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_transfers') THEN
        ALTER TABLE profiles ADD COLUMN can_access_transfers BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_warranties') THEN
        ALTER TABLE profiles ADD COLUMN can_access_warranties BOOLEAN DEFAULT false;
    END IF;
END $$;
