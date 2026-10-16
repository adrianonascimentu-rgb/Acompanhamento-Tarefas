-- Migration to create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insert default deliveries_enabled setting
INSERT INTO system_settings (key, value)
VALUES ('deliveries_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on system_settings') THEN
        CREATE POLICY "Allow all on system_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
