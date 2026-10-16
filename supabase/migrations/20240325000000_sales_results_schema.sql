-- Create sales_results table
CREATE TABLE IF NOT EXISTS sales_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collaborator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  result_2025 NUMERIC DEFAULT 0,
  target_suggestion NUMERIC DEFAULT 0,
  target_2026 NUMERIC DEFAULT 0,
  result_2026 NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collaborator_id, month, year)
);

-- Add can_access_sales column to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='can_access_sales') THEN
        ALTER TABLE profiles ADD COLUMN can_access_sales BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE sales_results ENABLE ROW LEVEL SECURITY;

-- Policies for sales_results
CREATE POLICY "Allow all on sales_results" ON sales_results FOR ALL USING (true) WITH CHECK (true);
