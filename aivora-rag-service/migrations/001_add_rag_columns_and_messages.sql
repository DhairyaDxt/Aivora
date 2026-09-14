-- Additive migration for knowledge_base_entries and messages table
-- Run against existing Supabase Postgres (do not touch tables/columns the Lovable app already depends on)

-- 1. Add columns to knowledge_base_entries
alter table knowledge_base_entries
  add column if not exists embedded_at timestamptz,
  add column if not exists needs_review boolean default false;

-- 2. Create IVFFlat index for vector similarity search
create index if not exists kb_embedding_idx
  on knowledge_base_entries using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. Create messages table for conversation logging
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null, -- 'customer' | 'ai'
  content text,
  created_at timestamptz default now()
);

-- 4. Grant permissions for service_role (already has all per existing migration)
-- The existing migration at line 157 already grants all on all tables to service_role

-- 5. Enable RLS on messages table
alter table messages enable row level security;

-- 6. Create RLS policy for messages (tenant isolation via conversations)
create policy tenant_isolation on messages for all to authenticated
  using (exists(
    select 1 from conversations c 
    where c.id = conversation_id 
    and public.is_org_member(c.org_id)
  ))
  with check (exists(
    select 1 from conversations c 
    where c.id = conversation_id 
    and public.is_org_member(c.org_id)
  ));

-- 7. Grant service_role access to messages (already covered by line 157 in original migration)
grant all on messages to service_role;