-- Add lat/lng columns to leads table for geographical tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;

-- Update existing mock data if any (optional, but good for local dev)
-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
