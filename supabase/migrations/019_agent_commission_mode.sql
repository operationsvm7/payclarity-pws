-- Persist the per-agent commission mode (% vs flat $ per invoice).
-- Added in the app UI before the database columns existed, so values
-- only lived in memory and disappeared on every reload.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS commission_mode TEXT CHECK (commission_mode IN ('percent', 'fixed'));

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS fixed_commission_amount NUMERIC(12,2);
