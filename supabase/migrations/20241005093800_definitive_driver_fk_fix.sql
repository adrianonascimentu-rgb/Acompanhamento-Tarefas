-- MIGRATION: DEFINITIVE FIX for deliveries driver foreign key
-- This migration handles data cleanup and multi-tenancy for the drivers table.

DO $$ 
BEGIN
    -- 1. Ensure company_id exists on drivers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='company_id') THEN
        ALTER TABLE public.drivers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
    END IF;

    -- 2. Drop legacy policies and add tenant isolation
    DROP POLICY IF EXISTS "Allow all on drivers" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_tenant_isolation_select" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_tenant_isolation_insert" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_tenant_isolation_update" ON public.drivers;
    DROP POLICY IF EXISTS "drivers_tenant_isolation_delete" ON public.drivers;
    
    CREATE POLICY "drivers_tenant_isolation_select" ON public.drivers FOR SELECT TO authenticated USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    CREATE POLICY "drivers_tenant_isolation_insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    CREATE POLICY "drivers_tenant_isolation_update" ON public.drivers FOR UPDATE TO authenticated USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    CREATE POLICY "drivers_tenant_isolation_delete" ON public.drivers FOR DELETE TO authenticated USING (public.is_auth_admin());

    -- 3. Data Cleanup: Map existing deliveries.driver_id from profiles to drivers table
    -- This fixes cases where driver_id was pointing to a profile (legacy) instead of the new drivers table.
    
    -- Temporarily drop the constraint to allow cleanup
    ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_driver_id_fkey;

    -- Safe cast driver_id to UUID
    ALTER TABLE public.deliveries 
    ALTER COLUMN driver_id TYPE UUID 
    USING (CASE WHEN driver_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN driver_id::UUID ELSE NULL END);

    -- Update deliveries where driver_id is NULL but we have a driver name, matching to a driver record
    UPDATE public.deliveries del
    SET driver_id = dr.id
    FROM public.drivers dr
    WHERE del.driver_id IS NULL 
    AND del.driver = dr.name
    AND dr.company_id = del.company_id;

    -- Update drivers without company_id by matching names with profiles
    UPDATE public.drivers dr
    SET company_id = pr.company_id
    FROM public.profiles pr
    WHERE dr.name = pr.name AND dr.company_id IS NULL AND pr.company_id IS NOT NULL;

    -- 4. Final step: Ensure all driver_ids in deliveries actually exist in drivers table
    -- If not, set to NULL to prevent FK violation on re-adding the constraint
    UPDATE public.deliveries
    SET driver_id = NULL
    WHERE driver_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = public.deliveries.driver_id);

    -- 5. Add the correct constraint pointing to the drivers table
    ALTER TABLE public.deliveries 
    ADD CONSTRAINT deliveries_driver_id_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.drivers(id) 
    ON DELETE SET NULL;

END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
