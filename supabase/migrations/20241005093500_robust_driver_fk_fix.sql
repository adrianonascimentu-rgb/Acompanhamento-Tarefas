-- MIGRATION: Final fix for deliveries driver foreign key and multi-tenancy
-- This migration ensures drivers table is multi-tenant and foreign keys are solid.

DO $$ 
BEGIN
    -- 1. Ensure company_id exists on drivers table for multi-tenancy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='company_id') THEN
        ALTER TABLE public.drivers ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;

    -- 2. Drop legacy "Allow all" policy and add tenant isolation
    DROP POLICY IF EXISTS "Allow all on drivers" ON public.drivers;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drivers_tenant_isolation_select' AND tablename = 'drivers') THEN
        CREATE POLICY "drivers_tenant_isolation_select" ON public.drivers
            FOR SELECT TO authenticated
            USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drivers_tenant_isolation_insert' AND tablename = 'drivers') THEN
        CREATE POLICY "drivers_tenant_isolation_insert" ON public.drivers
            FOR INSERT TO authenticated
            WITH CHECK (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drivers_tenant_isolation_update' AND tablename = 'drivers') THEN
        CREATE POLICY "drivers_tenant_isolation_update" ON public.drivers
            FOR UPDATE TO authenticated
            USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'drivers_tenant_isolation_delete' AND tablename = 'drivers') THEN
        CREATE POLICY "drivers_tenant_isolation_delete" ON public.drivers
            FOR DELETE TO authenticated
            USING (public.is_auth_admin());
    END IF;

    -- 3. Fix the Foreign Key constraint on deliveries
    -- Drop old one if exists (standard names and my previous custom name)
    ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_driver_id_fkey;
    
    -- Ensure driver_id column is UUID
    ALTER TABLE public.deliveries ALTER COLUMN driver_id TYPE UUID USING driver_id::UUID;

    -- Add the correct constraint
    ALTER TABLE public.deliveries 
    ADD CONSTRAINT deliveries_driver_id_fkey 
    FOREIGN KEY (driver_id) REFERENCES public.drivers(id) 
    ON DELETE SET NULL;

    -- 4. Re-seed drivers with company association from profiles if possible
    -- Only for drivers that don't have a company yet
    UPDATE public.drivers d
    SET company_id = p.company_id
    FROM public.profiles p
    WHERE d.name = p.name AND d.company_id IS NULL AND p.company_id IS NOT NULL;

END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
