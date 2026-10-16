-- ==============================================================================
-- MIGRATION: Row Level Security (RLS) for Multi-Tenant Isolation
-- Tables: tasks, leads, deliveries
-- Objective: Ensure users only access data from their own company (tenant).
-- ==============================================================================

-- 1. Ensure company_id column exists in all relevant tables
DO $$ 
BEGIN
    -- Leads Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='company_id') THEN
        ALTER TABLE leads ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
    
    -- Deliveries Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deliveries' AND column_name='company_id') THEN
        ALTER TABLE deliveries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
    
    -- Tasks Table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='company_id') THEN
        ALTER TABLE tasks ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Define Helper Functions (SECURITY DEFINER to prevent recursion)
-- These functions run with owner privileges and bypass RLS on the profiles table.

CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_auth_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (
            LOWER(type) IN ('admin', 'gerente') 
            OR LOWER(role) ILIKE '%admin%' 
            OR LOWER(role) ILIKE '%gerente%'
        )
    );
$$;

-- 3. Enable RLS on tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- 4. Clean up existing policies
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['tasks', 'leads', 'deliveries']) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_isolation_select" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_isolation_insert" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_isolation_update" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_isolation_delete" ON public.%I', t, t);
        -- Also drop common "Allow all" policies often used in dev
        EXECUTE format('DROP POLICY IF EXISTS "Allow all on %s" ON public.%I', t, t);
    END LOOP;
END $$;

-- 5. Define Multi-Tenant Policies

-- LEADS POLICIES
CREATE POLICY "leads_tenant_isolation_select" ON public.leads
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "leads_tenant_isolation_insert" ON public.leads
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "leads_tenant_isolation_update" ON public.leads
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "leads_tenant_isolation_delete" ON public.leads
    FOR DELETE TO authenticated
    USING (public.is_auth_admin());


-- DELIVERIES POLICIES
CREATE POLICY "deliveries_tenant_isolation_select" ON public.deliveries
    FOR SELECT TO authenticated
    USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "deliveries_tenant_isolation_insert" ON public.deliveries
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "deliveries_tenant_isolation_update" ON public.deliveries
    FOR UPDATE TO authenticated
    USING (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "deliveries_tenant_isolation_delete" ON public.deliveries
    FOR DELETE TO authenticated
    USING (public.is_auth_admin());


-- TASKS POLICIES (Includes specific check for assignees)
CREATE POLICY "tasks_tenant_isolation_select" ON public.tasks
    FOR SELECT TO authenticated
    USING (
        company_id = public.get_auth_company_id() 
        OR public.is_auth_admin()
        OR created_by = auth.uid()
        OR collaborator_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM task_assignees 
            WHERE task_id = tasks.id AND profile_id = auth.uid()
        )
    );

CREATE POLICY "tasks_tenant_isolation_insert" ON public.tasks
    FOR INSERT TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() OR public.is_auth_admin());

CREATE POLICY "tasks_tenant_isolation_update" ON public.tasks
    FOR UPDATE TO authenticated
    USING (
        company_id = public.get_auth_company_id() 
        OR public.is_auth_admin()
        OR created_by = auth.uid()
        OR collaborator_id = auth.uid()
    );

CREATE POLICY "tasks_tenant_isolation_delete" ON public.tasks
    FOR DELETE TO authenticated
    USING (public.is_auth_admin() OR created_by = auth.uid());


-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_company_id ON public.deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON public.tasks(company_id);

-- 7. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
