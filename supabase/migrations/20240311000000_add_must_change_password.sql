-- Add must_change_password column to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='must_change_password') THEN
        ALTER TABLE profiles ADD COLUMN must_change_password BOOLEAN DEFAULT false;
    END IF;
END $$;
