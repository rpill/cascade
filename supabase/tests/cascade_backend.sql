begin;
create extension if not exists pgtap;
select plan(12);

select is(
  public.cascade_resolve_account('pikabu','player-1','One',null),
  public.cascade_resolve_account('pikabu','player-1','One Updated',null),
  'same provider identity resolves to one account'
);

select lives_ok($$
  select public.cascade_put_profile(
    public.cascade_resolve_account('pikabu','profile-player','Profile',null),
    '11111111-1111-4111-8111-111111111111'::uuid, 0, 1, '{"schemaVersion":1,"meta":{}}'::jsonb
  )
$$, 'profile create succeeds');

select is(
  (select revision from public.cloud_profiles where account_id = public.cascade_resolve_account('pikabu','profile-player','Profile',null)),
  1::bigint,
  'profile starts at revision one'
);

select is(
  (public.cascade_put_profile(
    public.cascade_resolve_account('pikabu','profile-player','Profile',null),
    '22222222-2222-4222-8222-222222222222'::uuid, 1, 1, '{"schemaVersion":1,"meta":{"x":1}}'::jsonb
  )->>'revision')::bigint,
  2::bigint,
  'CAS success increments exactly once'
);

select is(
  public.cascade_put_profile(
    public.cascade_resolve_account('pikabu','profile-player','Profile',null),
    '33333333-3333-4333-8333-333333333333'::uuid, 1, 1, '{"schemaVersion":1,"meta":{"bad":1}}'::jsonb
  )->>'status',
  'conflict',
  'stale revision returns conflict'
);

select is(
  (select revision from public.cloud_profiles where account_id = public.cascade_resolve_account('pikabu','profile-player','Profile',null)),
  2::bigint,
  'stale revision does not update profile'
);

select is(
  (public.cascade_put_profile(
    public.cascade_resolve_account('pikabu','profile-player','Profile',null),
    '22222222-2222-4222-8222-222222222222'::uuid, 1, 1, '{"schemaVersion":1,"meta":{"other":1}}'::jsonb
  )->>'revision')::bigint,
  2::bigint,
  'repeated profile operation id returns original result'
);

with a as (select public.cascade_resolve_account('pikabu','daily-player','Daily',null) id)
select lives_ok(format($q$
  select public.cascade_submit_daily_result('%s'::uuid,'44444444-4444-4444-8444-444444444444'::uuid,'2026-09-20',null,90,5000,true)
$q$, (select id from a)), 'first Daily result inserts');

with a as (select public.cascade_resolve_account('pikabu','daily-player','Daily',null) id)
select is(
  public.cascade_submit_daily_result((select id from a),'55555555-5555-4555-8555-555555555555','2026-09-20',null,70,3000,true)->>'moves',
  '90',
  'second Daily result does not replace first official result'
);

with a as (select public.cascade_resolve_account('pikabu','daily-player','Daily',null) id)
select is(
  public.cascade_submit_daily_result((select id from a),'44444444-4444-4444-8444-444444444444','2026-09-20',null,1,1,true)->>'moves',
  '90',
  'repeated Daily operation id returns original result'
);

with a as (select public.cascade_resolve_account('pikabu','board-player','Board',null) id),
first_write as (
  select public.cascade_upsert_leaderboard_entry((select id from a),'66666666-6666-4666-8666-666666666666','standard','global',10,null,'{}')
), second_write as (
  select public.cascade_upsert_leaderboard_entry((select id from a),'77777777-7777-4777-8777-777777777777','standard','global',8,null,'{}')
)
select is((select primary_value from public.leaderboard_entries where account_id=(select id from a) and board_key='standard' and scope_key='global'),10::bigint,'Standard entry only increases') from first_write, second_write;

select ok(
  not has_table_privilege('anon','public.cloud_profiles','select')
  and not has_table_privilege('authenticated','public.cloud_profiles','select'),
  'anon/authenticated have no direct table access'
);

select * from finish();
rollback;
