-- Multi-page websites: pages become first-class rows so they can be added,
-- renamed, reordered and saved independently, while the nav bar and footer
-- move up to site level (shared across every page, edited once) - which is
-- how a real multi-page site behaves.

create table public.website_pages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  slug text not null,                       -- '' for the home page, else 'about', 'services', ...
  name text not null,
  sections jsonb not null default '[]',
  published_sections jsonb,
  sort_order int not null default 0,
  is_home boolean not null default false,
  show_in_nav boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (service_id, slug)
);

create index website_pages_service_idx on public.website_pages (service_id, sort_order);

grant select, insert, update, delete on public.website_pages to authenticated;
grant all on public.website_pages to service_role;

alter table public.website_pages enable row level security;

create policy tenant_isolation on public.website_pages for all to authenticated
  using (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)))
  with check (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)));

-- Site-wide header/footer, shared by every page.
alter table public.website_configs
  add column if not exists nav_variant text default 'simple',
  add column if not exists nav_content jsonb default '{}',
  add column if not exists footer_variant text default 'columns',
  add column if not exists footer_content jsonb default '{}';

-- Carry any existing single-page draft over to a home page row so nothing
-- built before this migration is lost.
insert into public.website_pages (service_id, slug, name, sections, published_sections, is_home, sort_order)
select service_id, '', 'Home', sections, published_sections, true, 0
from public.website_configs
on conflict (service_id, slug) do nothing;

-- Page content now lives in website_pages; these would only ever drift.
alter table public.website_configs
  drop column if exists sections,
  drop column if exists published_sections;
