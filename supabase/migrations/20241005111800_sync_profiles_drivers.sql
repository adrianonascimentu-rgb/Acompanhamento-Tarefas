-- MIGRATION: Automatic Sync between Profiles and Drivers
-- This ensures that any user with role 'entregador' or 'entrega' is automatically
-- available in the drivers table for the logistics module.

-- 1. Function to sync profile to driver
CREATE OR REPLACE FUNCTION public.sync_profile_to_driver()
RETURNS TRIGGER AS $$
BEGIN
    -- If profile is an entregador/delivery person and is active
    IF (NEW.type = 'entregador' OR NEW.role ILIKE '%entrega%' OR NEW.role ILIKE '%entregador%') AND NEW.active = true THEN
        INSERT INTO public.drivers (id, name, phone, company_id, active)
        VALUES (NEW.id, NEW.name, NEW.phone, NEW.company_id, true)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            company_id = EXCLUDED.company_id,
            active = EXCLUDED.active;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on profiles table
DROP TRIGGER IF EXISTS tr_sync_profile_to_driver ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_driver
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_driver();

-- 3. Initial sync for existing profiles
INSERT INTO public.drivers (id, name, phone, company_id, active)
SELECT id, name, phone, company_id, active 
FROM public.profiles 
WHERE (type = 'entregador' OR role ILIKE '%entrega%' OR role ILIKE '%entregador%')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    company_id = EXCLUDED.company_id,
    active = EXCLUDED.active;

-- 4. Notify PostgREST
NOTIFY pgrst, 'reload schema';
