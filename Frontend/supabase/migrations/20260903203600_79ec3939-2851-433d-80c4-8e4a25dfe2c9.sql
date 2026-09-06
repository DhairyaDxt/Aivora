create or replace function public.store_twilio_subaccount_secret(p_name text, p_secret text)
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
    v_id := vault.create_secret(p_secret, p_name, 'twilio subaccount credential');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'twilio subaccount credential');
  end if;
  return v_id;
end;
$$;

revoke execute on function public.store_twilio_subaccount_secret(text, text) from public, anon, authenticated;
grant execute on function public.store_twilio_subaccount_secret(text, text) to service_role;