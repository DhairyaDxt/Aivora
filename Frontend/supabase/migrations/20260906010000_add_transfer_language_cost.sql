-- Named transfer destinations (live-agent handoff), multilingual auto-detect,
-- and per-call cost tracking (from Vapi's end-of-call cost report).

alter table public.voice_agent_configs
  add column if not exists transfer_destinations jsonb default '[]'::jsonb,
  add column if not exists warm_transfer_enabled boolean default true,
  add column if not exists multilingual_enabled boolean default false;

alter table public.call_logs
  add column if not exists cost_usd numeric;
