-- Migration 016: Allow one user (admin) to manage multiple companies
-- Creates user_company_access table and migrates existing data.

CREATE TABLE IF NOT EXISTS public.user_company_access (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'rep', 'accountant')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  UNIQUE (user_id, company_id)
);

ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_access" ON public.user_company_access
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "superadmin_manage_access" ON public.user_company_access
  FOR ALL USING (public.is_superadmin());

-- Migrate existing active company users into the access table
INSERT INTO public.user_company_access (user_id, company_id, role)
SELECT p.id, p.company_id, COALESCE(p.role, 'admin')
FROM public.profiles p
WHERE p.company_id IS NOT NULL
  AND p.is_superadmin = false
  AND p.status = 'active'
ON CONFLICT DO NOTHING;
