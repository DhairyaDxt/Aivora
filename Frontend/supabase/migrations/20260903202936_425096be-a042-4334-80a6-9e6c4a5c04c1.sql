create extension if not exists vector;
create extension if not exists "uuid-ossp";

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  industry_vertical text,
  country text,
  timezone text not null default 'UTC',
  created_at timestamptz default now()
);

create table public.org_members (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'owner',
  created_at timestamptz default now(),
  primary key (org_id, user_id)
);

create table public.business_profiles (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  legal_name text,
  display_name text,
  description text,
  address jsonb,
  business_hours jsonb,
  languages text[] default array['en'],
  updated_at timestamptz default now()
);

create table public.knowledge_base_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  title text,
  content text not null,
  embedding vector(1536),
  source text default 'manual',
  status text default 'ready',
  file_path text,
  created_at timestamptz default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  type text not null default 'voice',
  name text,
  status text not null default 'draft',
  preview_opened_at timestamptz,
  created_at timestamptz default now(),
  deployed_at timestamptz
);

create table public.voice_agent_configs (
  service_id uuid primary key references public.services(id) on delete cascade,
  persona_name text,
  greeting_script text,
  consent_enabled boolean default true,
  consent_message text default 'This call may be recorded and you are speaking with an AI assistant.',
  language text default 'en',
  transcriber_provider text default 'deepgram',
  transcriber_model text default 'nova-2',
  transcriber_language text default 'en',
  llm_provider text default 'openai',
  llm_model text default 'gpt-4o-mini',
  temperature numeric default 0.5,
  custom_llm_url text,
  kb_enabled boolean default true,
  voice_provider text default '11labs',
  voice_id text,
  voice_model text default 'eleven_turbo_v2_5',
  functions_enabled jsonb default '{"check_availability":true,"book_appointment":true,"transfer_call":true,"take_message":true}',
  business_hours_override jsonb,
  escalation_number text,
  after_hours_behavior text default 'voicemail',
  max_call_duration_seconds int default 600,
  recording_enabled boolean default true,
  barge_in_enabled boolean default true,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  flow_ui_state jsonb,
  updated_at timestamptz default now()
);

create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  provider text not null,
  vapi_number_id text,
  twilio_sid text,
  number text not null,
  country text,
  monthly_cost_cents int,
  per_minute_cost_cents int,
  assigned_service_id uuid references public.services(id),
  status text default 'active',
  purchased_at timestamptz default now()
);

create table public.twilio_subaccounts (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  subaccount_sid text not null,
  auth_token_secret_ref text not null,
  status text default 'active',
  created_at timestamptz default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  service_id uuid references public.services(id),
  channel text default 'voice',
  customer_identifier text,
  status text default 'active',
  resolution_type text,
  is_sandbox boolean not null default false,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  vapi_call_id text,
  duration_seconds int,
  recording_url text,
  transcript text,
  outcome text,
  created_at timestamptz default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  actor_user_id uuid,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.org_members to authenticated;
grant select, insert, update, delete on public.business_profiles to authenticated;
grant select, insert, update, delete on public.knowledge_base_entries to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.voice_agent_configs to authenticated;
grant select, insert, update, delete on public.phone_numbers to authenticated;
grant select on public.twilio_subaccounts to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.call_logs to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.organizations, public.org_members, public.business_profiles, public.knowledge_base_entries, public.services, public.voice_agent_configs, public.phone_numbers, public.twilio_subaccounts, public.conversations, public.call_logs, public.audit_logs to service_role;

create or replace function public.is_org_member(target_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.org_members where org_id = target_org and user_id = auth.uid());
$$;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.business_profiles enable row level security;
alter table public.knowledge_base_entries enable row level security;
alter table public.services enable row level security;
alter table public.voice_agent_configs enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.twilio_subaccounts enable row level security;
alter table public.conversations enable row level security;
alter table public.call_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy tenant_isolation on public.organizations for all to authenticated using (public.is_org_member(id)) with check (public.is_org_member(id));
create policy insert_own_org on public.organizations for insert to authenticated with check (true);
create policy own_membership on public.org_members for all to authenticated using (user_id = auth.uid() or public.is_org_member(org_id)) with check (user_id = auth.uid());
create policy tenant_isolation on public.business_profiles for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy tenant_isolation on public.knowledge_base_entries for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy tenant_isolation on public.services for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy tenant_isolation on public.phone_numbers for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy tenant_isolation on public.twilio_subaccounts for select to authenticated using (public.is_org_member(org_id));
create policy tenant_isolation on public.conversations for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy tenant_isolation on public.audit_logs for select to authenticated using (public.is_org_member(org_id));
create policy tenant_isolation on public.voice_agent_configs for all to authenticated
  using (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)))
  with check (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)));
create policy tenant_isolation on public.call_logs for all to authenticated
  using (exists(select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.org_id)))
  with check (exists(select 1 from public.conversations c where c.id = conversation_id and public.is_org_member(c.org_id)));