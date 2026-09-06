-- Fixes for the RAG/orchestration audit:
-- 1. llm_model_escalated didn't exist in the DB even though the Python
--    service read it (silently falling back to a hardcoded OpenAI model
--    name regardless of the org's configured provider).
-- 2. conversations had no reliable per-call identity column, so the live
--    per-turn RAG endpoint and the end-of-call webhook each created their
--    own separate conversation row per real call (using customer_identifier
--    as an overloaded, incorrect dedup key on the RAG side).

alter table public.voice_agent_configs
  add column if not exists llm_model_escalated text;

alter table public.conversations
  add column if not exists vapi_call_id text;

create unique index if not exists conversations_vapi_call_id_key
  on public.conversations (vapi_call_id)
  where vapi_call_id is not null;
