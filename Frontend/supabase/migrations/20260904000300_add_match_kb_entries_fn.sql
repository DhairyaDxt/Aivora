-- pgvector RPC for knowledge-base similarity search
-- Used by the RAG service to find relevant knowledge base entries.
create or replace function public.match_kb_entries(
  query_embedding vector(1536),
  match_org_id   uuid,
  match_threshold float,
  match_count     int
)
returns table (
  id         uuid,
  title      text,
  content    text,
  similarity float
)
language sql stable
as $$
  select
    kbe.id,
    kbe.title,
    kbe.content,
    1 - (kbe.embedding <=> query_embedding) as similarity
  from knowledge_base_entries kbe
  where kbe.org_id = match_org_id
    and kbe.embedding is not null
    and kbe.status = 'ready'
    and 1 - (kbe.embedding <=> query_embedding) > match_threshold
  order by kbe.embedding <=> query_embedding
  limit match_count;
$$;

-- Grant execute to authenticated and service_role
grant execute on function public.match_kb_entries(vector, uuid, float, int) to authenticated;
grant execute on function public.match_kb_entries(vector, uuid, float, int) to service_role;
