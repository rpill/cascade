create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.identities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  public_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);
create unique index if not exists identities_provider_user_uidx on public.identities(provider, provider_user_id);

create table if not exists public.cloud_profiles (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  schema_version integer not null,
  revision bigint not null check (revision >= 1),
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_results (
  account_id uuid not null references public.accounts(id) on delete cascade,
  daily_id date not null,
  attempt_id text,
  moves integer not null check (moves > 0),
  elapsed_ms bigint not null check (elapsed_ms > 0),
  completed_on_time boolean not null,
  completed_at timestamptz not null default now(),
  operation_id uuid not null,
  primary key(account_id, daily_id),
  unique(account_id, operation_id)
);
create index if not exists daily_results_rank_idx on public.daily_results(daily_id, moves, elapsed_ms, completed_at);

create table if not exists public.leaderboard_entries (
  account_id uuid not null references public.accounts(id) on delete cascade,
  board_key text not null,
  scope_key text not null,
  primary_value bigint not null,
  secondary_value bigint,
  context jsonb,
  updated_at timestamptz not null default now(),
  primary key(account_id, board_key, scope_key)
);
create index if not exists leaderboard_entries_rank_idx on public.leaderboard_entries(board_key, scope_key, primary_value desc, secondary_value asc nulls last, updated_at asc);

create table if not exists public.idempotency_operations (
  account_id uuid not null references public.accounts(id) on delete cascade,
  operation_id uuid not null,
  operation_type text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(account_id, operation_id)
);

alter table public.accounts enable row level security;
alter table public.identities enable row level security;
alter table public.cloud_profiles enable row level security;
alter table public.daily_results enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.idempotency_operations enable row level security;

create or replace view public.cascade_public_leaderboard_entries as
select
  le.account_id,
  i.provider_user_id as player_id,
  coalesce(nullif(i.public_name, ''), 'Player') as public_name,
  i.avatar_url,
  le.board_key,
  le.scope_key,
  le.primary_value,
  le.secondary_value,
  le.context,
  le.updated_at
from public.leaderboard_entries le
join public.identities i on i.account_id = le.account_id and i.provider = 'pikabu';

create or replace view public.cascade_public_daily_results as
select
  dr.account_id,
  i.provider_user_id as player_id,
  coalesce(nullif(i.public_name, ''), 'Player') as public_name,
  i.avatar_url,
  dr.daily_id,
  dr.moves,
  dr.elapsed_ms,
  dr.completed_on_time,
  dr.completed_at
from public.daily_results dr
join public.identities i on i.account_id = dr.account_id and i.provider = 'pikabu';

create or replace function public.cascade_daily_streak_board(
  p_today date,
  p_account_id uuid default null
) returns table(
  account_id uuid,
  player_id text,
  public_name text,
  avatar_url text,
  current_streak bigint,
  best_streak bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with completed as (
    select distinct dr.account_id, dr.daily_id
    from public.daily_results dr
    where dr.completed_on_time = true
      and dr.daily_id <= p_today
      and (p_account_id is null or dr.account_id = p_account_id)
  ), numbered as (
    select
      c.account_id,
      c.daily_id,
      c.daily_id - (row_number() over (partition by c.account_id order by c.daily_id))::integer as run_key
    from completed c
  ), runs as (
    select
      n.account_id,
      min(n.daily_id) as start_date,
      max(n.daily_id) as end_date,
      count(*)::bigint as run_length
    from numbered n
    group by n.account_id, n.run_key
  ), summary as (
    select
      r.account_id,
      coalesce(max(r.run_length) filter (where r.end_date = p_today or r.end_date = p_today - 1), 0)::bigint as current_streak,
      coalesce(max(r.run_length), 0)::bigint as best_streak
    from runs r
    group by r.account_id
  )
  select
    s.account_id,
    i.provider_user_id as player_id,
    coalesce(nullif(i.public_name, ''), 'Player') as public_name,
    i.avatar_url,
    s.current_streak,
    s.best_streak
  from summary s
  join public.identities i on i.account_id = s.account_id and i.provider = 'pikabu'
  order by s.current_streak desc, s.best_streak desc, s.account_id asc;
$$;

create or replace function public.cascade_resolve_account(
  p_provider text,
  p_provider_user_id text,
  p_public_name text,
  p_avatar_url text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  if p_provider is null or btrim(p_provider) = '' or p_provider_user_id is null or btrim(p_provider_user_id) = '' then
    raise exception 'provider and provider_user_id are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_provider || ':' || p_provider_user_id));
  select account_id into v_account_id
  from public.identities
  where provider = p_provider and provider_user_id = p_provider_user_id;

  if v_account_id is null then
    insert into public.accounts default values returning id into v_account_id;
    insert into public.identities(account_id, provider, provider_user_id, public_name, avatar_url)
    values(v_account_id, p_provider, p_provider_user_id, nullif(btrim(p_public_name), ''), nullif(btrim(p_avatar_url), ''));
  else
    update public.identities
      set public_name = nullif(btrim(p_public_name), ''),
          avatar_url = nullif(btrim(p_avatar_url), ''),
          updated_at = now()
      where provider = p_provider and provider_user_id = p_provider_user_id;
  end if;
  return v_account_id;
end;
$$;

create or replace function public.cascade_put_profile(
  p_account_id uuid,
  p_operation_id uuid,
  p_expected_revision bigint,
  p_schema_version integer,
  p_profile jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_revision bigint;
  v_profile jsonb;
  v_result jsonb;
begin
  select result into v_existing from public.idempotency_operations
    where account_id = p_account_id and operation_id = p_operation_id;
  if v_existing is not null then return v_existing; end if;

  perform pg_advisory_xact_lock(hashtext(p_account_id::text || ':profile'));
  select revision, profile into v_revision, v_profile from public.cloud_profiles where account_id = p_account_id;

  if v_revision is null then
    if p_expected_revision <> 0 then
      v_result := jsonb_build_object('status','conflict','revision',0,'profile',null);
    else
      insert into public.cloud_profiles(account_id, schema_version, revision, profile)
      values(p_account_id, p_schema_version, 1, p_profile);
      v_result := jsonb_build_object('status','saved','revision',1,'profile',p_profile);
    end if;
  elsif v_revision <> p_expected_revision then
    v_result := jsonb_build_object('status','conflict','revision',v_revision,'profile',v_profile);
  else
    update public.cloud_profiles
      set schema_version = p_schema_version,
          revision = revision + 1,
          profile = p_profile,
          updated_at = now()
      where account_id = p_account_id
      returning revision, profile into v_revision, v_profile;
    v_result := jsonb_build_object('status','saved','revision',v_revision,'profile',v_profile);
  end if;

  insert into public.idempotency_operations(account_id, operation_id, operation_type, result)
  values(p_account_id, p_operation_id, 'profile', v_result)
  on conflict(account_id, operation_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.cascade_submit_daily_result(
  p_account_id uuid,
  p_operation_id uuid,
  p_daily_id date,
  p_attempt_id text,
  p_moves integer,
  p_elapsed_ms bigint,
  p_completed_on_time boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_row public.daily_results%rowtype;
  v_inserted boolean := false;
  v_row_count integer := 0;
  v_result jsonb;
begin
  select result into v_existing from public.idempotency_operations
    where account_id = p_account_id and operation_id = p_operation_id;
  if v_existing is not null then return v_existing; end if;

  insert into public.daily_results(account_id, daily_id, attempt_id, moves, elapsed_ms, completed_on_time, operation_id)
  values(p_account_id, p_daily_id, p_attempt_id, p_moves, p_elapsed_ms, p_completed_on_time, p_operation_id)
  on conflict(account_id, daily_id) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  select * into v_row from public.daily_results where account_id = p_account_id and daily_id = p_daily_id;
  v_result := jsonb_build_object(
    'status', case when v_inserted then 'accepted' else 'existing' end,
    'dailyId', v_row.daily_id::text,
    'moves', v_row.moves,
    'elapsedMs', v_row.elapsed_ms,
    'completedOnTime', v_row.completed_on_time,
    'attemptId', v_row.attempt_id,
    'completedAt', v_row.completed_at
  );

  insert into public.idempotency_operations(account_id, operation_id, operation_type, result)
  values(p_account_id, p_operation_id, 'daily', v_result)
  on conflict(account_id, operation_id) do nothing;
  return v_result;
end;
$$;

create or replace function public.cascade_upsert_leaderboard_entry(
  p_account_id uuid,
  p_operation_id uuid,
  p_board_key text,
  p_scope_key text,
  p_primary_value bigint,
  p_secondary_value bigint,
  p_context jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_row public.leaderboard_entries%rowtype;
  v_result jsonb;
begin
  select result into v_existing from public.idempotency_operations
    where account_id = p_account_id and operation_id = p_operation_id;
  if v_existing is not null then return v_existing; end if;

  insert into public.leaderboard_entries(account_id, board_key, scope_key, primary_value, secondary_value, context)
  values(p_account_id, p_board_key, p_scope_key, p_primary_value, p_secondary_value, p_context)
  on conflict(account_id, board_key, scope_key) do update
    set primary_value = case
          when excluded.primary_value > public.leaderboard_entries.primary_value then excluded.primary_value
          else public.leaderboard_entries.primary_value end,
        secondary_value = case
          when excluded.primary_value > public.leaderboard_entries.primary_value then excluded.secondary_value
          when excluded.primary_value = public.leaderboard_entries.primary_value then least(public.leaderboard_entries.secondary_value, excluded.secondary_value)
          else public.leaderboard_entries.secondary_value end,
        context = case
          when excluded.primary_value >= public.leaderboard_entries.primary_value then excluded.context
          else public.leaderboard_entries.context end,
        updated_at = case
          when excluded.primary_value >= public.leaderboard_entries.primary_value then now()
          else public.leaderboard_entries.updated_at end;

  select * into v_row from public.leaderboard_entries
    where account_id = p_account_id and board_key = p_board_key and scope_key = p_scope_key;
  v_result := jsonb_build_object(
    'status','saved',
    'boardKey',v_row.board_key,
    'scopeKey',v_row.scope_key,
    'primaryValue',v_row.primary_value,
    'secondaryValue',v_row.secondary_value,
    'context',v_row.context
  );

  insert into public.idempotency_operations(account_id, operation_id, operation_type, result)
  values(p_account_id, p_operation_id, 'leaderboard:' || p_board_key, v_result)
  on conflict(account_id, operation_id) do nothing;
  return v_result;
end;
$$;

revoke all on public.accounts, public.identities, public.cloud_profiles, public.daily_results, public.leaderboard_entries, public.idempotency_operations from anon, authenticated;
revoke all on function public.cascade_resolve_account(text,text,text,text) from public, anon, authenticated;
revoke all on function public.cascade_put_profile(uuid,uuid,bigint,integer,jsonb) from public, anon, authenticated;
revoke all on function public.cascade_submit_daily_result(uuid,uuid,date,text,integer,bigint,boolean) from public, anon, authenticated;
revoke all on function public.cascade_upsert_leaderboard_entry(uuid,uuid,text,text,bigint,bigint,jsonb) from public, anon, authenticated;


revoke all on public.cascade_public_leaderboard_entries, public.cascade_public_daily_results from public, anon, authenticated;
revoke all on function public.cascade_daily_streak_board(date,uuid) from public, anon, authenticated;
grant select on public.cascade_public_leaderboard_entries, public.cascade_public_daily_results to service_role;
grant execute on function public.cascade_daily_streak_board(date,uuid) to service_role;
