-- Add receives_leads column to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='receives_leads') THEN
        ALTER TABLE profiles ADD COLUMN receives_leads BOOLEAN DEFAULT true;
    END IF;
END $$;
