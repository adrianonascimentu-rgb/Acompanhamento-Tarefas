-- Create warranties table
CREATE TABLE IF NOT EXISTS warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_number SERIAL,
    received_at DATE NOT NULL,
    received_by TEXT NOT NULL,
    defect TEXT NOT NULL,
    fiscal_document_type TEXT NOT NULL,
    fiscal_document_number TEXT NOT NULL,
    fiscal_document_date DATE NOT NULL,
    product TEXT NOT NULL,
    brand_supplier TEXT NOT NULL,
    observation TEXT,
    should_discard TEXT NOT NULL,
    process_responsible TEXT NOT NULL,
    type TEXT NOT NULL,
    assistance_name TEXT,
    assistance_phone TEXT,
    assistance_address TEXT,
    sent_at DATE,
    sent_by TEXT,
    reserved_in_system TEXT,
    nfe_remessa TEXT,
    nfe_retorno TEXT,
    returned_at DATE,
    returned_by TEXT,
    assistance_observation TEXT,
    status TEXT NOT NULL DEFAULT 'Aberto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add status column if it missed for some reason
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='warranties' AND column_name='status'
    ) THEN
        ALTER TABLE warranties ADD COLUMN status TEXT NOT NULL DEFAULT 'Aberto';
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow all on warranties" ON warranties;

-- Create a permissive policy
CREATE POLICY "Allow all on warranties" ON warranties FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time for warranties
ALTER PUBLICATION supabase_realtime ADD TABLE warranties;
