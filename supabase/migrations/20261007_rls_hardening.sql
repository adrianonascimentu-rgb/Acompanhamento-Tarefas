-- Migration: Complete RLS Hardening, Task Membership Fix, Trigger Protection & Multi-Table Policies

-- 1. Helper SECURITY DEFINER Functions to Avoid RLS Recursion
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND (type = 'admin' OR role = 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_task_member(p_task uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees 
    WHERE task_id = p_task AND profile_id = auth.uid()
  );
$$;

-- 2. Trigger to Prevent Self-Elevation / Privilege Escalation on Profiles Table
CREATE OR REPLACE FUNCTION public.protect_profile_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If invoked via client/user session (auth.uid() is NOT NULL) and user is NOT an admin:
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.type := OLD.type;
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.company_id := OLD.company_id;
    NEW.can_access_leads := OLD.can_access_leads;
    NEW.can_access_deliveries := OLD.can_access_deliveries;
    NEW.can_access_transfers := OLD.can_access_transfers;
    NEW.can_access_warranties := OLD.can_access_warranties;
    NEW.can_access_reports := OLD.can_access_reports;
    NEW.can_access_whatsapp := OLD.can_access_whatsapp;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_profile ON public.profiles;
CREATE TRIGGER trg_protect_profile BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- 3. Unauthenticated Login Lookup RPC Function (Security Definer)
CREATE OR REPLACE FUNCTION public.login_lookup(p_identifier text)
RETURNS TABLE(email text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email, p.username
  FROM profiles p
  WHERE lower(p.username) = lower(p_identifier)
     OR lower(p.email) = lower(p_identifier)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.login_lookup(text) TO anon, authenticated;

-- 4. Enable RLS on All Main Application Tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Drop Permissive Policies across Schema
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 6. Clean RLS Policies Without Subquery Recursion

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id OR
    (company_id IS NOT NULL AND company_id = public.get_user_company_id()) OR
    public.is_admin()
  );

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert_delete" ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin());

-- TRANSFERS
CREATE POLICY "transfers_select" ON public.transfers FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid() OR
    responsible_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "transfers_insert" ON public.transfers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "transfers_update" ON public.transfers FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid() OR
    responsible_id = auth.uid() OR
    public.is_admin()
  );

CREATE POLICY "transfers_delete" ON public.transfers FOR DELETE TO authenticated
  USING (public.is_admin() OR requester_id = auth.uid());

-- LEADS
CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid() OR
    (company_id IS NOT NULL AND company_id = public.get_user_company_id()) OR
    public.is_admin()
  );

CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.is_admin());

CREATE POLICY "leads_delete" ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin());

-- COMPETITOR PRICES
CREATE POLICY "competitor_prices_all" ON public.competitor_prices FOR ALL TO authenticated
  USING (
    created_by = auth.uid() OR
    (company_id IS NOT NULL AND company_id = public.get_user_company_id()) OR
    public.is_admin()
  );

-- SYSTEM SETTINGS
CREATE POLICY "system_settings_select" ON public.system_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "system_settings_write" ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin());

-- PUSH SUBSCRIPTIONS
CREATE POLICY "push_subscriptions_all" ON public.push_subscriptions FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

-- TASKS (Linked via task_assignees via SECURITY DEFINER function)
CREATE POLICY "tasks_all" ON public.tasks FOR ALL TO authenticated
  USING (
    created_by = auth.uid() OR
    public.is_task_member(id) OR
    public.is_admin()
  );

-- NOTIFICATIONS (Restricted to recipient profile or admin)
CREATE POLICY "notifications_all" ON public.notifications FOR ALL TO authenticated
  USING (
    profile_id = auth.uid() OR
    public.is_admin()
  );

-- 7. Dynamically Enable RLS and Create Generic Policies for Remaining Auxiliary Tables
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'task_assignees','task_comments','profile_skills','reviews',
    'assistances','sales','sale_items','products','social_media_tasks',
    'vehicles','companies','deliveries','warranties','demands','drivers','sales_results'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_all', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL)', t||'_all', t);
    END IF;
  END LOOP;
END $$;
