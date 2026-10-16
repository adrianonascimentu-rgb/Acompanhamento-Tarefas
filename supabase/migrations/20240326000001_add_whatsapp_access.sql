-- Add missing module access columns to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_whatsapp') THEN
        ALTER TABLE profiles ADD COLUMN can_access_whatsapp BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_sales') THEN
        ALTER TABLE profiles ADD COLUMN can_access_sales BOOLEAN DEFAULT false;
    END IF;
END $$;
