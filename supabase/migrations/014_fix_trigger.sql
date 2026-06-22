-- Migration 014: Fix handle_new_user trigger for is_superadmin schema
-- Run AFTER 013_superadmin_flag.sql
--
-- Fixes:
-- 1. Removes the obsolete `role != 'superadmin'` filter (superadmins now use is_superadmin flag)
-- 2. Recreates the trigger so it's guaranteed to exist and be enabled
-- 3. Repairs any auth users that have no profile (retroactive fix)

-- ── 1. Updated trigger function ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id     uuid;
  v_existing_count integer;
  v_role           text;
  v_status         text;
BEGIN
  -- company_id is passed in raw_user_meta_data by the register form
  v_company_id := nullif(trim(new.raw_user_meta_data->>'company_id'), '')::uuid;

  IF v_company_id IS NOT NULL THEN
    -- Count active profiles already in this company (company-role users only)
    SELECT count(*) INTO v_existing_count
    FROM public.profiles
    WHERE company_id = v_company_id;

    IF v_existing_count = 0 THEN
      -- First user in this company: auto-promote to admin
      v_role   := 'admin';
      v_status := 'active';
    ELSE
      -- Subsequent users: pending until an admin approves
      v_role   := null;
      v_status := 'pending';
    END IF;
  ELSE
    -- No company_id → superadmin invite or manual creation; start pending
    v_role   := null;
    v_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, is_superadmin, status, company_id)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    false,   -- is_superadmin set later by consume_superadmin_invite() if applicable
    v_status,
    v_company_id
  )
  ON CONFLICT (id) DO UPDATE
    SET
      role       = EXCLUDED.role,
      status     = EXCLUDED.status,
      company_id = coalesce(profiles.company_id, EXCLUDED.company_id),
      updated_at = timezone('utc', now());

  RETURN new;
END;
$$;

-- ── 2. Re-attach trigger (idempotent) ─────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Repair: create profiles for any auth users that slipped through ─────────
INSERT INTO public.profiles (id, email, full_name, role, is_superadmin, status, company_id)
SELECT
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  null,
  false,
  'pending',
  null
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
