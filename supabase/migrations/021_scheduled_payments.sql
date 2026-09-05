-- Lets admin schedule a future payout date on a payment instead of only
-- recording money that has already been sent.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS scheduled_date TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('scheduled', 'paid'));
