-- Add visibility and target inclusion flags to sales_results
ALTER TABLE sales_results ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;
ALTER TABLE sales_results ADD COLUMN IF NOT EXISTS has_target BOOLEAN DEFAULT true;
