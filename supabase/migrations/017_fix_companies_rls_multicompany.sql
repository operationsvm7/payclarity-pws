-- Migration 017: Allow users to read all companies they have access to
-- via user_company_access, not just their currently-active company.
-- Without this, the join companies(id, name) in auth-context.tsx returns null
-- for non-active companies, causing the "—" display bug.

CREATE POLICY "companies_select_access"
  ON public.companies FOR SELECT
  USING (
    id IN (
      SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
  );
