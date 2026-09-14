-- Website builder channel: a business picks a curated template, gets an
-- AI-personalized draft, edits it visually, and publishes to their own
-- personal Vercel account (paste-a-token, same pattern as WhatsApp's manual
-- connect - no platform-level app review needed to ship this).

create table public.website_configs (
  service_id uuid primary key references public.services(id) on delete cascade,
  template_id text not null,
  theme jsonb not null default '{}',        -- {primaryColor, accentColor, fontHeading, fontBody, radius}
  sections jsonb not null default '[]',     -- ordered [{id, type, variant, visible, content}]
  published_sections jsonb,                 -- snapshot of `sections` at last successful publish
  published_theme jsonb,
  vercel_token_secret_ref text,
  vercel_project_id text,
  vercel_project_name text,
  deployment_url text,
  connection_status text not null default 'not_connected', -- not_connected | connected
  last_error text,
  last_published_at timestamptz,
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.website_configs to authenticated;
grant all on public.website_configs to service_role;

alter table public.website_configs enable row level security;

create policy tenant_isolation on public.website_configs for all to authenticated
  using (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)))
  with check (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)));

-- Vault secret helpers for the Vercel personal access token, same pattern as
-- store_whatsapp_secret / store_calendly_secret.
create or replace function public.store_vercel_secret(p_name text, p_secret text)
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
    v_id := vault.create_secret(p_secret, p_name, 'vercel personal access token');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'vercel personal access token');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.store_vercel_secret(text, text) from public, anon, authenticated;
grant execute on function public.store_vercel_secret(text, text) to service_role;

create or replace function public.read_vercel_secret(p_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name;
$$;

revoke execute on function public.read_vercel_secret(text) from public, anon, authenticated;
grant execute on function public.read_vercel_secret(text) to service_role;

create or replace function public.delete_vercel_secret(p_name text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;

revoke execute on function public.delete_vercel_secret(text) from public, anon, authenticated;
grant execute on function public.delete_vercel_secret(text) to service_role;

-- Storage bucket for uploaded website images (hero photos, gallery, etc).
-- Created properly here via migration, unlike knowledge-docs which was set
-- up out-of-band - this way a fresh environment gets it for free.
insert into storage.buckets (id, name, public)
values ('website-assets', 'website-assets', true)
on conflict (id) do nothing;

create policy "org members read website assets" on storage.objects for select to authenticated
using (bucket_id = 'website-assets' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org members upload website assets" on storage.objects for insert to authenticated
with check (bucket_id = 'website-assets' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "org members delete website assets" on storage.objects for delete to authenticated
using (bucket_id = 'website-assets' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "public read website assets" on storage.objects for select to anon
using (bucket_id = 'website-assets');
