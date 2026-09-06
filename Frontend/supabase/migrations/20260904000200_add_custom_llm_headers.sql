-- Add custom_llm_headers column to voice_agent_configs for orchestration auth headers
alter table voice_agent_configs
  add column if not exists custom_llm_headers jsonb;

-- Grant permissions (already covered by existing grant to service_role)
grant all on voice_agent_configs to service_role;
