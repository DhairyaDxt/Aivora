-- Calendly integration: lets each org connect its own Calendly account so the
-- voice receptionist can check real availability and book real appointments
-- via Calendly's Scheduling API (POST /invitees), instead of just taking a
-- message when a caller asks to book.

create table public.calendly_connections (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  calendly_user_uri text not null,
  organization_uri text,
  scheduling_url text,
  owner_name text,
  owner_email text,
  timezone text,
  event_type_uri text,
  event_type_name text,
  event_type_duration_minutes int,
  access_token_secret_ref text not null,
  refresh_token_secret_ref text not null,
  token_expires_at timestamptz not null,
  status text not null default 'connected',
  connected_at timestamptz default now(),
  updated_at timestamptz default now()
);

grant select on public.calendly_connections to authenticated;
grant all on public.calendly_connections to service_role;

alter table public.calendly_connections enable row level security;

-- Client reads status only; all writes (connect/refresh/disconnect) go
-- through server functions using the service role, same as twilio_subaccounts.
create policy tenant_isolation on public.calendly_connections for select to authenticated
  using (public.is_org_member(org_id));

create or replace function public.store_calendly_secret(p_name text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    v_id := vault.create_secret(p_secret, p_name, 'calendly oauth token');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'calendly oauth token');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.store_calendly_secret(text, text) from public, anon, authenticated;
grant execute on function public.store_calendly_secret(text, text) to service_role;

create or replace function public.read_calendly_secret(p_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name;
$$;

revoke execute on function public.read_calendly_secret(text) from public, anon, authenticated;
grant execute on function public.read_calendly_secret(text) to service_role;

create or replace function public.delete_calendly_secret(p_name text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;

revoke execute on function public.delete_calendly_secret(text) from public, anon, authenticated;
grant execute on function public.delete_calendly_secret(text) to service_role;
