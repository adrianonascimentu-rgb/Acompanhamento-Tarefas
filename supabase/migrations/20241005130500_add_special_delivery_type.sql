-- Migration to support special delivery types (Entrega/Retirada Especial)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='delivery_type') THEN
        ALTER TABLE deliveries ADD COLUMN delivery_type TEXT DEFAULT 'padrao';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='is_special') THEN
        ALTER TABLE deliveries ADD COLUMN is_special BOOLEAN DEFAULT false;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
