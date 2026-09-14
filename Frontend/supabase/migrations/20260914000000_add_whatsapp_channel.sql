-- WhatsApp channel: a business connects its own WhatsApp Business Account
-- (via Meta Embedded Signup, or a pasted System User token as a fallback)
-- and Aivora answers customer messages with the same knowledge base and
-- booking tools the voice receptionist already uses.

create table public.whatsapp_bot_configs (
  service_id uuid primary key references public.services(id) on delete cascade,
  persona_name text,
  welcome_message text,
  bot_personality_prompt text,
  kb_enabled boolean default true,
  llm_provider text default 'gemini',
  llm_model text default 'gemini-2.5-flash',
  llm_model_escalated text,
  temperature numeric default 0.5,
  functions_enabled jsonb default '{"check_availability":true,"book_appointment":true,"take_message":true,"request_human_handoff":true}',
  human_handoff_keywords text[] default array['agent','human','representative','talk to someone','speak to someone'],
  escalation_number text,
  after_hours_behavior text default 'take_message',
  business_hours_override jsonb,
  session_timeout_minutes int default 1440,
  -- Connection (Meta Embedded Signup or manual System User token entry)
  waba_id text,
  phone_number_id text,
  phone_number_display text,
  whatsapp_business_name text,
  access_token_secret_ref text,
  token_type text, -- 'embedded' | 'manual'
  token_expires_at timestamptz,
  connection_status text not null default 'not_connected', -- not_connected | connected | error
  last_error text,
  connected_at timestamptz,
  updated_at timestamptz default now()
);

grant select, insert, update, delete on public.whatsapp_bot_configs to authenticated;
grant all on public.whatsapp_bot_configs to service_role;

alter table public.whatsapp_bot_configs enable row level security;

create policy tenant_isolation on public.whatsapp_bot_configs for all to authenticated
  using (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)))
  with check (exists(select 1 from public.services s where s.id = service_id and public.is_org_member(s.org_id)));

-- Vault secret helpers for the Meta access token, same pattern as
-- store_calendly_secret / store_twilio_subaccount_secret.
create or replace function public.store_whatsapp_secret(p_name text, p_secret text)
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
    v_id := vault.create_secret(p_secret, p_name, 'whatsapp cloud api access token');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'whatsapp cloud api access token');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.store_whatsapp_secret(text, text) from public, anon, authenticated;
grant execute on function public.store_whatsapp_secret(text, text) to service_role;

create or replace function public.read_whatsapp_secret(p_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name;
$$;

revoke execute on function public.read_whatsapp_secret(text) from public, anon, authenticated;
grant execute on function public.read_whatsapp_secret(text) to service_role;

create or replace function public.delete_whatsapp_secret(p_name text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  delete from vault.secrets where name = p_name;
end;
$$;

revoke execute on function public.delete_whatsapp_secret(text) from public, anon, authenticated;
grant execute on function public.delete_whatsapp_secret(text) to service_role;

-- messages: WhatsApp needs to distinguish text/image/etc, carry provider
-- metadata, and dedupe Meta's webhook retries by their message id.
alter table public.messages
  add column if not exists content_type text default 'text',
  add column if not exists metadata jsonb,
  add column if not exists wa_message_id text;

create unique index if not exists messages_wa_message_id_key
  on public.messages (wa_message_id)
  where wa_message_id is not null;

-- conversations: last_message_at drives the inbox sort order and the
-- get-or-create-conversation session-timeout lookup (reuse an existing
-- WhatsApp thread if the last message was within session_timeout_minutes).
alter table public.conversations
  add column if not exists last_message_at timestamptz default now();

create index if not exists conversations_service_customer_idx
  on public.conversations (service_id, customer_identifier, last_message_at desc)
  where channel = 'whatsapp';
