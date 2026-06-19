-- Migration 011: Purge demo data from all tables
-- Run this in Supabase SQL Editor to remove all data seeded by the
-- "Load Demo" button (agents with @demo.co emails and all related records).
--
-- SAFE TO RUN MULTIPLE TIMES — uses DELETE WHERE, no side effects if already clean.

do $$
declare
  demo_agent_ids uuid[];
  demo_invoice_ids uuid[];
begin

  -- 1. Collect demo agent IDs (agents with @demo.co emails)
  select array_agg(id) into demo_agent_ids
  from public.agents
  where email ilike '%@demo.co';

  if demo_agent_ids is null or array_length(demo_agent_ids, 1) = 0 then
    raise notice 'No demo agents found — nothing to purge.';
    return;
  end if;

  raise notice 'Found % demo agent(s) to remove.', array_length(demo_agent_ids, 1);

  -- 2. Collect demo invoice IDs (invoices belonging to demo agents)
  select array_agg(id) into demo_invoice_ids
  from public.invoices
  where agent_id = any(demo_agent_ids);

  -- 3. Remove invoice child records first (FK constraints)
  if demo_invoice_ids is not null then
    delete from public.invoice_split_participants
    where invoice_split_id in (
      select id from public.invoice_splits
      where invoice_id = any(demo_invoice_ids)
    );

    delete from public.invoice_splits
    where invoice_id = any(demo_invoice_ids);

    delete from public.invoice_line_items
    where invoice_id = any(demo_invoice_ids);

    delete from public.invoice_pdf_records
    where invoice_id = any(demo_invoice_ids);

    raise notice 'Removed child records for % demo invoice(s).', array_length(demo_invoice_ids, 1);
  end if;

  -- 4. Remove invoices
  delete from public.invoices
  where agent_id = any(demo_agent_ids);

  -- 5. Remove payments linked to demo agents
  delete from public.payments
  where agent_id = any(demo_agent_ids);

  -- 6. Remove adjustments linked to demo agents
  delete from public.adjustments
  where agent_id = any(demo_agent_ids);

  -- 7. Remove disputes linked to demo agents
  delete from public.dispute_events
  where dispute_id in (
    select id from public.disputes where agent_id = any(demo_agent_ids)
  );
  delete from public.disputes
  where agent_id = any(demo_agent_ids);

  -- 8. Remove demo agents themselves (sponsor_id FK — delete children before parents)
  --    First null out sponsor_id references that point to demo agents
  update public.agents
  set sponsor_id = null
  where sponsor_id = any(demo_agent_ids);

  delete from public.agents
  where id = any(demo_agent_ids);

  raise notice 'Demo data purge complete.';

end $$;
