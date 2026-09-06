-- Add app_config table for orchestration service configuration
create table if not exists app_config (
  id boolean primary key default true,
  orchestration_url text,
  orchestration_enabled boolean default false,
  check (id)
);

-- Enable RLS
alter table app_config enable row level security;

-- Only service_role can modify, authenticated can read
create policy "service_role full access" on app_config
  for all to service_role using (true) with check (true);

create policy "authenticated read" on app_config
  for select to authenticated using (true);

-- Grant permissions
grant select on app_config to authenticated;
grant all on app_config to service_role;

-- Insert default row
insert into app_config (id, orchestration_enabled)
values (true, false)
on conflict (id) do nothing;
