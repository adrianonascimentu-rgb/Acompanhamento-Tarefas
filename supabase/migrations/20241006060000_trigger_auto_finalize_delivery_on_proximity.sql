-- ======================================================================================
-- MIGRATION: Gatilho no Supabase para Finalização Automática de Entrega por Proximidade GPS
-- Regra de Negócio: Alterar automaticamente o status da entrega para 'Finalizada' 
-- quando a localização do entregador coincidir com o endereço de destino (distância < 50m).
-- ======================================================================================

-- 1. Assegurar colunas de coordenadas de destino e do motorista na tabela deliveries
DO $$ 
BEGIN
    -- Coordenadas do endereço de destino
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='destination_lat') THEN
        ALTER TABLE deliveries ADD COLUMN destination_lat DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='destination_lng') THEN
        ALTER TABLE deliveries ADD COLUMN destination_lng DOUBLE PRECISION;
    END IF;

    -- Coordenadas atuais do motorista/entregador
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='driver_lat') THEN
        ALTER TABLE deliveries ADD COLUMN driver_lat DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='driver_lng') THEN
        ALTER TABLE deliveries ADD COLUMN driver_lng DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='current_lat') THEN
        ALTER TABLE deliveries ADD COLUMN current_lat DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='current_lng') THEN
        ALTER TABLE deliveries ADD COLUMN current_lng DOUBLE PRECISION;
    END IF;

    -- Data/hora de finalização automática por proximidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='finalized_at') THEN
        ALTER TABLE deliveries ADD COLUMN finalized_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='auto_finalized') THEN
        ALTER TABLE deliveries ADD COLUMN auto_finalized BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Migrar dados legados: se destino estiver nulo mas lat/lng existirem, preencher destino
UPDATE deliveries
SET destination_lat = lat, destination_lng = lng
WHERE destination_lat IS NULL AND lat IS NOT NULL;

-- 3. Função matemática de Haversine para calcular distância precisa em metros entre duas coordenadas GPS
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371000.0; -- Raio da Terra em metros
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  -- Se qualquer coordenada for nula ou inválida, retorna nulo
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  -- Se as coordenadas forem exatamente iguais, distância é 0
  IF lat1 = lat2 AND lon1 = lon2 THEN
    RETURN 0.0;
  END IF;

  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := (sin(dlat / 2.0) ^ 2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       (sin(dlon / 2.0) ^ 2);

  -- Limitar a 1.0 para prevenir erros numéricos de ponto flutuante
  IF a > 1.0 THEN
    a := 1.0;
  END IF;

  c := 2.0 * atan2(sqrt(a), sqrt(GREATEST(0.0, 1.0 - a)));

  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Função do Gatilho para a tabela 'deliveries'
CREATE OR REPLACE FUNCTION fn_auto_finalize_delivery_on_proximity()
RETURNS TRIGGER AS $$
DECLARE
  dest_lat DOUBLE PRECISION;
  dest_lng DOUBLE PRECISION;
  curr_lat DOUBLE PRECISION := NULL;
  curr_lng DOUBLE PRECISION := NULL;
  dist_meters DOUBLE PRECISION;
  route_len INT;
  last_point JSONB;
BEGIN
  -- Se a entrega já estiver finalizada ou cancelada, não precisa recalcular
  IF NEW.status IN ('Finalizada', 'Cancelada', 'Desistiu') THEN
    RETURN NEW;
  END IF;

  -- 1. Determinar as coordenadas do endereço de destino:
  -- Prioridade: destination_lat/lng explícitos > lat/lng do momento da criação (OLD.lat ou NEW.lat inicial)
  dest_lat := COALESCE(NEW.destination_lat, OLD.destination_lat);
  dest_lng := COALESCE(NEW.destination_lng, OLD.destination_lng);

  -- Se destination_lat for nulo no INSERT, define com o lat/lng recebido
  IF TG_OP = 'INSERT' THEN
    IF dest_lat IS NULL AND NEW.lat IS NOT NULL THEN
      dest_lat := NEW.lat;
      NEW.destination_lat := NEW.lat;
    END IF;
    IF dest_lng IS NULL AND NEW.lng IS NOT NULL THEN
      dest_lng := NEW.lng;
      NEW.destination_lng := NEW.lng;
    END IF;
  ELSE
    -- No UPDATE, se destination_lat ainda estiver nulo, tenta resgatar do registro anterior
    IF dest_lat IS NULL THEN
      dest_lat := COALESCE(OLD.destination_lat, OLD.lat);
      NEW.destination_lat := dest_lat;
    END IF;
    IF dest_lng IS NULL THEN
      dest_lng := COALESCE(OLD.destination_lng, OLD.lng);
      NEW.destination_lng := dest_lng;
    END IF;
  END IF;

  -- 2. Determinar a localização atual do entregador:
  -- Prioridade 1: driver_lat / driver_lng ou current_lat / current_lng
  IF NEW.driver_lat IS NOT NULL AND NEW.driver_lng IS NOT NULL THEN
    curr_lat := NEW.driver_lat;
    curr_lng := NEW.driver_lng;
  ELSIF NEW.current_lat IS NOT NULL AND NEW.current_lng IS NOT NULL THEN
    curr_lat := NEW.current_lat;
    curr_lng := NEW.current_lng;
  END IF;

  -- Prioridade 2: Último ponto da rota percorrida (se houver histórico de rota em JSONB)
  IF curr_lat IS NULL AND NEW.route IS NOT NULL AND jsonb_typeof(NEW.route) = 'array' THEN
    route_len := jsonb_array_length(NEW.route);
    IF route_len > 0 THEN
      last_point := NEW.route -> (route_len - 1);
      IF jsonb_typeof(last_point) = 'array' AND jsonb_array_length(last_point) >= 2 THEN
        curr_lat := (last_point ->> 0)::DOUBLE PRECISION;
        curr_lng := (last_point ->> 1)::DOUBLE PRECISION;
      END IF;
    END IF;
  END IF;

  -- Prioridade 3: Se lat/lng foi atualizado (diferente do destino original ou no UPDATE)
  IF curr_lat IS NULL AND TG_OP = 'UPDATE' THEN
    IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
      -- Se NEW.destination_lat foi preservado e NEW.lat representa a nova posição reportada pelo app
      IF (OLD.lat IS DISTINCT FROM NEW.lat OR OLD.lng IS DISTINCT FROM NEW.lng) THEN
        curr_lat := NEW.lat;
        curr_lng := NEW.lng;
      END IF;
    END IF;
  END IF;

  -- 3. Se temos tanto a posição atual do entregador quanto o destino, calcular a distância:
  IF curr_lat IS NOT NULL AND curr_lng IS NOT NULL AND dest_lat IS NOT NULL AND dest_lng IS NOT NULL THEN
    dist_meters := calculate_distance_meters(curr_lat, curr_lng, dest_lat, dest_lng);

    -- REGRA DE NEGÓCIO: Se a distância for menor que 50 metros (< 50m)
    IF dist_meters IS NOT NULL AND dist_meters < 50.0 THEN
      NEW.status := 'Finalizada';
      NEW.auto_finalized := true;
      NEW.finalized_at := TIMEZONE('utc'::text, NOW());
      
      -- Registra observação informativa sem sobrescrever notas anteriores
      IF NEW.notes IS NULL OR NEW.notes = '' THEN
        NEW.notes := '[FINALIZADA AUTOMATICAMENTE POR GPS: Proximidade < 50m]';
      ELSIF NOT (NEW.notes LIKE '%FINALIZADA AUTOMATICAMENTE%') THEN
        NEW.notes := NEW.notes || ' | [FINALIZADA AUTOMATICAMENTE POR GPS: Proximidade < 50m]';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar o Gatilho (Trigger) na tabela deliveries
DROP TRIGGER IF EXISTS trg_auto_finalize_delivery_proximity ON deliveries;
CREATE TRIGGER trg_auto_finalize_delivery_proximity
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_finalize_delivery_on_proximity();

-- 6. Gatilho complementar na tabela 'drivers' (caso o app atualize a localização na tabela de motoristas)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
    -- Adicionar colunas de localização na tabela drivers caso não existam
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='current_lat') THEN
      ALTER TABLE drivers ADD COLUMN current_lat DOUBLE PRECISION;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='current_lng') THEN
      ALTER TABLE drivers ADD COLUMN current_lng DOUBLE PRECISION;
    END IF;
  END IF;
END $$;

-- Função para atualizar entregas quando a localização do motorista for atualizada na tabela drivers
CREATE OR REPLACE FUNCTION fn_check_driver_deliveries_proximity()
RETURNS TRIGGER AS $$
DECLARE
  rec RECORD;
  dist_meters DOUBLE PRECISION;
BEGIN
  -- Se a localização do motorista não foi alterada ou é nula, encerra
  IF NEW.current_lat IS NULL OR NEW.current_lng IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar todas as entregas ativas deste motorista
  FOR rec IN 
    SELECT id, destination_lat, destination_lng, lat, lng 
    FROM deliveries 
    WHERE driver_id = NEW.id 
      AND status NOT IN ('Finalizada', 'Cancelada', 'Desistiu')
  LOOP
    DECLARE
      target_lat DOUBLE PRECISION := COALESCE(rec.destination_lat, rec.lat);
      target_lng DOUBLE PRECISION := COALESCE(rec.destination_lng, rec.lng);
    BEGIN
      IF target_lat IS NOT NULL AND target_lng IS NOT NULL THEN
        dist_meters := calculate_distance_meters(NEW.current_lat, NEW.current_lng, target_lat, target_lng);
        
        -- Se estiver a menos de 50m do destino da entrega
        IF dist_meters IS NOT NULL AND dist_meters < 50.0 THEN
          UPDATE deliveries 
          SET 
            status = 'Finalizada',
            auto_finalized = true,
            finalized_at = TIMEZONE('utc'::text, NOW()),
            driver_lat = NEW.current_lat,
            driver_lng = NEW.current_lng,
            notes = COALESCE(notes, '') || ' | [FINALIZADA AUTOMATICAMENTE POR GPS: Motorista a ' || ROUND(dist_meters::numeric, 1) || 'm]'
          WHERE id = rec.id;
        END IF;
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gatilho condicional para a tabela drivers
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drivers') THEN
    DROP TRIGGER IF EXISTS trg_driver_proximity_deliveries ON drivers;
    CREATE TRIGGER trg_driver_proximity_deliveries
      AFTER INSERT OR UPDATE OF current_lat, current_lng ON drivers
      FOR EACH ROW
      EXECUTE FUNCTION fn_check_driver_deliveries_proximity();
  END IF;
END $$;

-- Notificar PostgREST para recarregar o cache do schema
NOTIFY pgrst, 'reload schema';
