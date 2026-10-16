-- Add Everton to profiles if not exists
INSERT INTO profiles (name, role, type, email, can_access_sales)
VALUES ('Everton', 'Vendedor', 'vendedor', 'everton@camposequipamentos.com.br', true)
ON CONFLICT (email) DO UPDATE SET can_access_sales = true;

-- Ensure other sellers have can_access_sales = true
UPDATE profiles SET can_access_sales = true WHERE name IN ('Joabson Lima', 'Alex Estevam', 'Carlos Marciel', 'Leonardo Albino');

-- Insert/Update results for March 2026
-- Joabson Lima
INSERT INTO sales_results (collaborator_id, month, year, result_2025, target_suggestion, target_2026, result_2026)
SELECT id, 3, 2026, 42304.31, 46560.12, 60000.00, 65676.32 FROM profiles WHERE name = 'Joabson Lima'
ON CONFLICT (collaborator_id, month, year) DO UPDATE SET
  result_2025 = EXCLUDED.result_2025,
  target_suggestion = EXCLUDED.target_suggestion,
  target_2026 = EXCLUDED.target_2026,
  result_2026 = EXCLUDED.result_2026;

-- Everton
INSERT INTO sales_results (collaborator_id, month, year, result_2025, target_suggestion, target_2026, result_2026)
SELECT id, 3, 2026, 0, 0, 0, 0 FROM profiles WHERE name = 'Everton'
ON CONFLICT (collaborator_id, month, year) DO UPDATE SET
  result_2025 = EXCLUDED.result_2025,
  target_suggestion = EXCLUDED.target_suggestion,
  target_2026 = EXCLUDED.target_2026,
  result_2026 = EXCLUDED.result_2026;

-- Carlos Marciel
INSERT INTO sales_results (collaborator_id, month, year, result_2025, target_suggestion, target_2026, result_2026)
SELECT id, 3, 2026, 105010.57, 115574.63, 110000.00, 120192.23 FROM profiles WHERE name = 'Carlos Marciel'
ON CONFLICT (collaborator_id, month, year) DO UPDATE SET
  result_2025 = EXCLUDED.result_2025,
  target_suggestion = EXCLUDED.target_suggestion,
  target_2026 = EXCLUDED.target_2026,
  result_2026 = EXCLUDED.result_2026;

-- Alex Estevam
INSERT INTO sales_results (collaborator_id, month, year, result_2025, target_suggestion, target_2026, result_2026)
SELECT id, 3, 2026, 109630.74, 120659.59, 80000.00, 201695.91 FROM profiles WHERE name = 'Alex Estevam'
ON CONFLICT (collaborator_id, month, year) DO UPDATE SET
  result_2025 = EXCLUDED.result_2025,
  target_suggestion = EXCLUDED.target_suggestion,
  target_2026 = EXCLUDED.target_2026,
  result_2026 = EXCLUDED.result_2026;

-- Leonardo Albino
INSERT INTO sales_results (collaborator_id, month, year, result_2025, target_suggestion, target_2026, result_2026)
SELECT id, 3, 2026, 39095.41, 43028.41, 50000.00, 25287.67 FROM profiles WHERE name = 'Leonardo Albino'
ON CONFLICT (collaborator_id, month, year) DO UPDATE SET
  result_2025 = EXCLUDED.result_2025,
  target_suggestion = EXCLUDED.target_suggestion,
  target_2026 = EXCLUDED.target_2026,
  result_2026 = EXCLUDED.result_2026;
