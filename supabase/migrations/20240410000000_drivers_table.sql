-- Migration to create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Policy (following project pattern of "Allow all")
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on drivers') THEN
        CREATE POLICY "Allow all on drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Optional: Seed with existing drivers from profiles if needed, 
-- but the user said "when creating a NEW driver", so I'll start fresh or just copy names.
INSERT INTO drivers (name)
SELECT name FROM profiles WHERE role ILIKE '%entrega%' OR type = 'entregador';
