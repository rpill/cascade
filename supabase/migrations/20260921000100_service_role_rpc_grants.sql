-- Edge Functions access the database through SUPABASE_SERVICE_ROLE_KEY.
-- The initial migration intentionally revoked PUBLIC/anon/authenticated EXECUTE
-- on mutation/account RPCs, but omitted the explicit service_role grants.
-- Without these grants, authenticated Pikabu requests fail in the Edge Function
-- when resolving the verified platform identity to a backend account.

grant execute on function public.cascade_resolve_account(text,text,text,text) to service_role;
grant execute on function public.cascade_put_profile(uuid,uuid,bigint,integer,jsonb) to service_role;
grant execute on function public.cascade_submit_daily_result(uuid,uuid,date,text,integer,bigint,boolean) to service_role;
grant execute on function public.cascade_upsert_leaderboard_entry(uuid,uuid,text,text,bigint,bigint,jsonb) to service_role;
