-- Add username column to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE profiles ADD COLUMN username TEXT;
    END IF;
END $$;

-- Update existing profiles with a default username based on their name if username is null
UPDATE profiles SET username = LOWER(REPLACE(name, ' ', '.')) WHERE username IS NULL;

-- Specifically set 'Nascimento' for the admin
UPDATE profiles SET username = 'Nascimento' WHERE email = 'adrianonascimentu@gmail.com' OR name = 'Adriano Nascimento';

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
    END IF;
END $$;
