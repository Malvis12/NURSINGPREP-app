-- Migration: 20261123000015_paid_unlocks.sql

-- 1. Add purpose to payments table (default 'access' for all existing records)
alter table public.payments
  add column if not exists purpose text not null default 'access'
  check (purpose in ('access', 'unlock'));

-- 2. Platform settings table for dynamic configuration (never hardcoded in frontend)
create table if not exists public.platform_settings (
  key text primary key,
  value_numeric numeric,
  value_text text,
  updated_at timestamptz default now()
);

alter table public.platform_settings enable row level security;

-- Allow authenticated and anon to read platform settings (e.g. fees)
drop policy if exists "Anyone can read platform settings" on public.platform_settings;
create policy "Anyone can read platform settings"
  on public.platform_settings for select
  to authenticated, anon
  using (true);

-- Seed unlock fee (500 NGN) and monthly cap (2)
insert into public.platform_settings (key, value_numeric, value_text)
values
  ('unlock_fee_ngn', 500, 'Fee in NGN for self-service account unlock'),
  ('unlock_monthly_cap', 2, 'Maximum paid self-unlocks allowed per 30-day window')
on conflict (key) do update set
  value_numeric = excluded.value_numeric,
  value_text = excluded.value_text;

-- 3. Check student unlock eligibility
create or replace function public.check_unlock_eligibility()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_locked boolean;
  v_unlock_fee numeric;
  v_monthly_cap int;
  v_paid_unlocks_recent int;
  v_has_pending_payment boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('eligible', false, 'reason', 'unauthenticated');
  end if;

  select is_locked into v_is_locked
  from public.profiles
  where id = v_user_id;

  if not coalesce(v_is_locked, false) then
    return jsonb_build_object('eligible', false, 'reason', 'not_locked');
  end if;

  -- Read settings
  select value_numeric into v_unlock_fee from public.platform_settings where key = 'unlock_fee_ngn';
  select value_numeric::int into v_monthly_cap from public.platform_settings where key = 'unlock_monthly_cap';
  v_unlock_fee := coalesce(v_unlock_fee, 500);
  v_monthly_cap := coalesce(v_monthly_cap, 2);

  -- Count paid unlocks in the last 30 days
  select count(*) into v_paid_unlocks_recent
  from public.payments
  where user_id = v_user_id
    and purpose = 'unlock'
    and status = 'success'
    and verified_at >= (now() - interval '30 days');

  if v_paid_unlocks_recent >= v_monthly_cap then
    return jsonb_build_object(
      'eligible', false,
      'reason', 'cap_exceeded',
      'cap', v_monthly_cap,
      'paid_count', v_paid_unlocks_recent
    );
  end if;

  -- Check if an unlock payment is already pending in the last 30 minutes
  select exists (
    select 1 from public.payments
    where user_id = v_user_id
      and purpose = 'unlock'
      and status = 'pending'
      and created_at >= (now() - interval '30 minutes')
  ) into v_has_pending_payment;

  return jsonb_build_object(
    'eligible', true,
    'fee_ngn', v_unlock_fee,
    'cap', v_monthly_cap,
    'remaining_unlocks', (v_monthly_cap - v_paid_unlocks_recent),
    'has_pending', v_has_pending_payment
  );
end;
$$;

revoke execute on function public.check_unlock_eligibility() from public, anon;
grant execute on function public.check_unlock_eligibility() to authenticated;

-- 4. unlock_after_payment() called exclusively by webhook for purpose = 'unlock'
create or replace function public.unlock_after_payment(
  p_payment_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
begin
  -- Strict verification: payment must exist, belong to user, have succeeded, and have purpose 'unlock'
  select * into v_payment
  from public.payments
  where id = p_payment_id
    and user_id = p_user_id
    and status = 'success'
    and purpose = 'unlock';

  if not found then
    return false;
  end if;

  -- Unlock student account
  update public.profiles
  set is_locked = false,
      lock_pending = false,
      locked_at = null
  where id = p_user_id;

  -- Clear device session revocations
  update public.device_sessions
  set revoked_at = null,
      revoked_reason = null
  where user_id = p_user_id;

  -- Log unlock event (resets the 30-day switch counter window)
  insert into public.session_events (user_id, event, created_at)
  values (p_user_id, 'unlock', now());

  return true;
end;
$$;

revoke execute on function public.unlock_after_payment(uuid, uuid) from public, anon;
grant execute on function public.unlock_after_payment(uuid, uuid) to authenticated, service_role;

-- 5. Updated admin_overview to strictly separate Access Revenue vs Unlock Revenue
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_students int;
  v_active_students int;
  v_pending_students int;
  v_access_revenue bigint;
  v_unlock_revenue bigint;
  v_total_approved_questions int;
  v_questions_by_level jsonb;
  v_completed_exams int;
  v_recent_signups jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Student counts
  select
    count(*)::int,
    count(*) filter (where is_active = true)::int,
    count(*) filter (where is_active = false)::int
  into
    v_total_students,
    v_active_students,
    v_pending_students
  from public.profiles;

  -- Separated verified revenues (minor units - kobo)
  select coalesce(sum(amount_minor), 0)::bigint
  into v_access_revenue
  from public.payments
  where status = 'success' and purpose = 'access';

  select coalesce(sum(amount_minor), 0)::bigint
  into v_unlock_revenue
  from public.payments
  where status = 'success' and purpose = 'unlock';

  -- Question bank counts
  select count(*)::int
  into v_total_approved_questions
  from public.questions
  where status = 'approved';

  select coalesce(
    jsonb_object_agg(al.code, coalesce(sub.cnt, 0)),
    '{}'::jsonb
  )
  into v_questions_by_level
  from academic_levels al
  left join (
    select c.level_id, count(q.id)::int as cnt
    from courses c
    join questions q on q.course_id = c.id and q.status = 'approved'
    group by c.level_id
  ) sub on sub.level_id = al.id;

  -- Completed exams
  select count(*)::int
  into v_completed_exams
  from public.exam_attempts
  where submitted_at is not null;

  -- 5 most recent signups
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'full_name', s.full_name,
        'email', u.email,
        'level', s.level,
        'is_active', s.is_active,
        'created_at', s.created_at
      )
    ),
    '[]'::jsonb
  )
  into v_recent_signups
  from (
    select id, full_name, level, is_active, created_at
    from public.profiles
    order by created_at desc
    limit 5
  ) s
  join auth.users u on u.id = s.id;

  return jsonb_build_object(
    'total_students', v_total_students,
    'active_students', v_active_students,
    'pending_students', v_pending_students,
    'verified_revenue', (v_access_revenue + v_unlock_revenue),
    'access_revenue', v_access_revenue,
    'unlock_revenue', v_unlock_revenue,
    'total_approved_questions', v_total_approved_questions,
    'questions_by_level', v_questions_by_level,
    'completed_exams', v_completed_exams,
    'recent_signups', v_recent_signups
  );
end;
$$;

revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
