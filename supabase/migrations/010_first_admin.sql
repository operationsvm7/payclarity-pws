-- Migration 010: Auto-promote the first user of a company to admin
-- Run this in Supabase SQL Editor after 001–009 have been applied.
--
-- Problem: All registered users start as pending/null role.
-- If someone creates a new company via invite code and is the first to register,
-- there's no existing admin to approve them → deadlock.
--
-- Fix: The handle_new_user() trigger now checks how many profiles already exist
-- for the company. If zero, the user gets role='admin' + status='active' automatically.
-- All subsequent users still start pending and need admin approval.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_existing_count integer;
  v_role text;
  v_status text;
begin
  -- company_id is passed in raw_user_meta_data by the register form
  v_company_id := nullif(trim(new.raw_user_meta_data->>'company_id'), '')::uuid;

  if v_company_id is not null then
    -- Count profiles already in this company (excluding superadmin accounts)
    select count(*) into v_existing_count
    from public.profiles
    where company_id = v_company_id
      and role != 'superadmin';

    if v_existing_count = 0 then
      -- First user: auto-promote to admin so the company is immediately usable
      v_role   := 'admin';
      v_status := 'active';
    else
      -- Subsequent users: pending until existing admin approves
      v_role   := null;
      v_status := 'pending';
    end if;
  else
    -- No company_id in metadata → leave pending (shouldn't happen via normal register flow)
    v_role   := null;
    v_status := 'pending';
  end if;

  insert into public.profiles (id, email, full_name, role, status, company_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    v_status,
    v_company_id
  )
  on conflict (id) do update
    set
      role       = excluded.role,
      status     = excluded.status,
      company_id = coalesce(profiles.company_id, excluded.company_id),
      updated_at = timezone('utc', now());

  return new;
end;
$$;
