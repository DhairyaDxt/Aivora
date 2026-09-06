-- Advanced Vapi assistant settings that were missing from voice_agent_configs,
-- plus a call summary column populated by Vapi's end-of-call analysis.

alter table public.voice_agent_configs
  add column if not exists first_message_mode text default 'assistant-speaks-first',
  add column if not exists background_sound text default 'office',
  add column if not exists voicemail_detection_enabled boolean default false,
  add column if not exists voicemail_message text,
  add column if not exists end_call_message text,
  add column if not exists end_call_phrases_enabled boolean default false,
  add column if not exists call_summary_enabled boolean default true;

alter table public.call_logs
  add column if not exists summary text;
