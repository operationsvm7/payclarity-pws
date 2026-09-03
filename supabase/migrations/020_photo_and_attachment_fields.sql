-- Three fields the frontend already lets users fill in, but that never
-- had a database column — so they were lost on every reload (same class
-- of bug as 019_agent_commission_mode.sql).

-- Agent profile photo (Equipo de ventas)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Product photo (Productos)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Evidence attachment on a correction/dispute request (Aprobaciones)
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS attachment_url TEXT;
