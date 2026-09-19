-- ============================================================================
-- HYD-LOGIX Phase 00A: Authentication & Role Authorization Schema
-- Database Migration: 20260918000000_init_auth_and_profiles.sql
-- ============================================================================

-- 1. ROLE ENUM
-- Defines the two strictly separated roles in the HYD-LOGIX platform.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('CONTROL_CENTER', 'DRIVER');
    END IF;
END $$;

-- 2. PROFILES TABLE
-- Directly mapped 1:1 with auth.users. Stores identity and immutable role.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by email or role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. PERMISSIONS / API GRANTS
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- 4. ROLE IMMUTABILITY TRIGGER
-- Enforces that a role can NEVER be changed once written to the profile.
CREATE OR REPLACE FUNCTION public.handle_profile_updates()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Reject any attempt to modify role
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'HYD-LOGIX Security Violation: User role is permanent and cannot be modified after registration.';
    END IF;

    -- Ensure id cannot be modified
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'HYD-LOGIX Security Violation: User ID cannot be modified.';
    END IF;

    -- Keep updated_at fresh
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_immutability ON public.profiles;
CREATE TRIGGER enforce_profile_immutability
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_profile_updates();

-- 5. AUTOMATIC PROFILE CREATION ON SIGNUP
-- Extracts metadata passed during supabase.auth.signUp() and reliably populates profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assigned_role public.user_role;
    user_full_name TEXT;
    raw_role_str TEXT;
BEGIN
    -- Extract full_name
    user_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'HYD-LOGIX Operator');

    -- Extract and validate role
    raw_role_str := NEW.raw_user_meta_data->>'role';

    IF raw_role_str = 'CONTROL_CENTER' THEN
        assigned_role := 'CONTROL_CENTER'::public.user_role;
    ELSIF raw_role_str = 'DRIVER' THEN
        assigned_role := 'DRIVER'::public.user_role;
    ELSE
        RAISE EXCEPTION 'HYD-LOGIX Registration Violation: Valid role (CONTROL_CENTER or DRIVER) is mandatory.';
    END IF;

    -- Insert new profile
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        assigned_role,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. HELPER FUNCTION TO GET CURRENT USER ROLE
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Control Center can view driver profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile name" ON public.profiles;
DROP POLICY IF EXISTS "Prevent direct profile inserts by clients" ON public.profiles;

-- Rule: Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) = id);

-- Rule: Control Center can view driver profiles for fleet coordination
CREATE POLICY "Control Center can view driver profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.get_current_user_role() = 'CONTROL_CENTER'::public.user_role 
        AND role = 'DRIVER'::public.user_role
    );

-- Rule: Users can update their own profile (name only - role guarded by trigger)
CREATE POLICY "Users can update own profile name"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- Rule: Direct inserts blocked for clients (handled exclusively by auth trigger)
CREATE POLICY "Prevent direct profile inserts by clients"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (false);
