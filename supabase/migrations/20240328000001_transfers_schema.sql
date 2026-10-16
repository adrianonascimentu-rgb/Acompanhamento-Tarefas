-- Migration to create transfers table if it doesn't exist
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sequential_number SERIAL,
  requester_name TEXT NOT NULL,
  requester_id UUID REFERENCES profiles(id),
  description TEXT NOT NULL,
  request_date DATE NOT NULL,
  status TEXT DEFAULT 'Solicitado',
  responsible_id UUID REFERENCES profiles(id),
  type TEXT DEFAULT 'solicitada',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy for the demo
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on transfers') THEN
        CREATE POLICY "Allow all on transfers" ON transfers FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
