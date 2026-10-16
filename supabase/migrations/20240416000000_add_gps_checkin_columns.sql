-- Migration: Campos de Destino e Check-in com Validação GPS para Tarefas e Entregas

ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS destination_address TEXT,
  ADD COLUMN IF NOT EXISTS destination_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;

-- Índices opcionais para buscas rápidas de tarefas com geolocalização
CREATE INDEX IF NOT EXISTS idx_tasks_checkin_at ON tasks(checkin_at);
