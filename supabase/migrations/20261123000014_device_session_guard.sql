-- Migration: 20261123000014_device_session_guard.sql

-- 1. Extend profiles with lockout columns
alter table public.profiles
  add column if not exists is_locked boolean not null default false,
  add column if not exists lock_pending boolean not null default false,
  add column if not exists locked_at timestamptz;

-- 2. Create device_sessions table
create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  constraint uq_user_session unique(user_id, session_id)
);

create index if not exists idx_device_sessions_user_live
  on public.device_sessions(user_id, last_seen_at)
  where revoked_at is null;

-- 3. Create session_events table
create table if not exists public.session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  event text not null check (event in ('login', 'switch', 'lock', 'unlock', 'signout')),
  created_at timestamptz not null default now()
);

create index if not exists idx_session_events_user_time
  on public.session_events(user_id, created_at desc);

-- 4. Enable RLS with no policies (Functions only)
alter table public.device_sessions enable row level security;
alter table public.session_events enable row level security;

-- 5. Helper function to check if an exam attempt is currently in progress
create or replace function public.has_exam_in_progress(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.exam_attempts
    where user_id = p_user_id
      and submitted_at is null
  );
$$;

-- 6. register_session()
create or replace function public.register_session()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := coalesce(auth.jwt() ->> 'session_id', 'session_' || v_user_id::text);
  v_is_admin boolean;
  v_is_locked boolean;
  v_live_count int;
  v_oldest_session_id text;
  v_recent_switches int;
  v_last_unlock_time timestamptz;
  v_exam_active boolean;
begin
  if v_user_id is null then
    return 'unauthenticated';
  end if;

  -- Admin accounts are exempt
  select exists (
    select 1 from public.user_roles
    where user_id = v_user_id and role = 'admin'
  ) into v_is_admin;

  if v_is_admin then
    return 'exempt';
  end if;

  -- Check current profile lock status
  select is_locked into v_is_locked
  from public.profiles
  where id = v_user_id;

  if v_is_locked then
    return 'locked';
  end if;

  -- Upsert current session row (revoked_at reset if reactivating same session)
  insert into public.device_sessions (user_id, session_id, created_at, last_seen_at, revoked_at, revoked_reason)
  values (v_user_id, v_session_id, now(), now(), null, null)
  on conflict (user_id, session_id)
  do update set
    last_seen_at = now(),
    revoked_at = null,
    revoked_reason = null;

  -- Log login event
  insert into public.session_events (user_id, session_id, event, created_at)
  values (v_user_id, v_session_id, 'login', now());

  -- Count live sessions (last seen in last 5 minutes and not revoked)
  select count(*) into v_live_count
  from public.device_sessions
  where user_id = v_user_id
    and revoked_at is null
    and last_seen_at >= (now() - interval '5 minutes');

  -- If more than 2 live sessions, evict the oldest live session (excluding the current one)
  if v_live_count > 2 then
    select session_id into v_oldest_session_id
    from public.device_sessions
    where user_id = v_user_id
      and revoked_at is null
      and session_id <> v_session_id
      and last_seen_at >= (now() - interval '5 minutes')
    order by last_seen_at asc
    limit 1;

    if v_oldest_session_id is not null then
      update public.device_sessions
      set revoked_at = now(),
          revoked_reason = 'switch_eviction'
      where user_id = v_user_id
        and session_id = v_oldest_session_id;

      insert into public.session_events (user_id, session_id, event, created_at)
      values (v_user_id, v_oldest_session_id, 'switch', now());

      -- Count switches since last unlock (or last 30 days)
      select coalesce(max(created_at), now() - interval '30 days')
      into v_last_unlock_time
      from public.session_events
      where user_id = v_user_id and event = 'unlock';

      select count(*) into v_recent_switches
      from public.session_events
      where user_id = v_user_id
        and event = 'switch'
        and created_at >= v_last_unlock_time
        and created_at >= (now() - interval '30 days');

      -- If 3 or more switches, lock account
      if v_recent_switches >= 3 then
        v_exam_active := public.has_exam_in_progress(v_user_id);
        if v_exam_active then
          -- Do not interrupt exam: flag lock_pending
          update public.profiles
          set lock_pending = true
          where id = v_user_id;
          return 'lock_pending';
        else
          update public.profiles
          set is_locked = true,
              lock_pending = false,
              locked_at = now()
          where id = v_user_id;

          insert into public.session_events (user_id, session_id, event, created_at)
          values (v_user_id, v_session_id, 'lock', now());

          return 'locked';
        end if;
      end if;
    end if;
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.register_session() from public, anon;
grant execute on function public.register_session() to authenticated;

-- 7. heartbeat_session()
create or replace function public.heartbeat_session()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := coalesce(auth.jwt() ->> 'session_id', 'session_' || v_user_id::text);
  v_is_admin boolean;
  v_is_locked boolean;
  v_lock_pending boolean;
  v_revoked_at timestamptz;
  v_exam_active boolean;
begin
  if v_user_id is null then
    return 'unauthenticated';
  end if;

  -- Admin exemption
  select exists (
    select 1 from public.user_roles
    where user_id = v_user_id and role = 'admin'
  ) into v_is_admin;

  if v_is_admin then
    return 'ok';
  end if;

  -- Check profile flags
  select is_locked, lock_pending into v_is_locked, v_lock_pending
  from public.profiles
  where id = v_user_id;

  v_exam_active := public.has_exam_in_progress(v_user_id);

  if v_is_locked then
    return 'locked';
  end if;

  -- If lock_pending was set and exam has finished, apply the lock now
  if v_lock_pending and not v_exam_active then
    update public.profiles
    set is_locked = true,
        lock_pending = false,
        locked_at = now()
    where id = v_user_id;

    insert into public.session_events (user_id, session_id, event, created_at)
    values (v_user_id, v_session_id, 'lock', now());

    return 'locked';
  end if;

  -- Check session status
  select revoked_at into v_revoked_at
  from public.device_sessions
  where user_id = v_user_id
    and session_id = v_session_id;

  -- Update last_seen_at
  update public.device_sessions
  set last_seen_at = now()
  where user_id = v_user_id
    and session_id = v_session_id;

  -- If revoked: if exam in progress, allow student to finish without interruption
  if v_revoked_at is not null then
    if v_exam_active then
      return 'ok';
    end if;
    return 'revoked';
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.heartbeat_session() from public, anon;
grant execute on function public.heartbeat_session() to authenticated;

-- 8. end_session()
create or replace function public.end_session()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id text := coalesce(auth.jwt() ->> 'session_id', 'session_' || v_user_id::text);
begin
  if v_user_id is null then
    return false;
  end if;

  update public.device_sessions
  set revoked_at = now(),
      revoked_reason = 'signout'
  where user_id = v_user_id
    and session_id = v_session_id;

  insert into public.session_events (user_id, session_id, event, created_at)
  values (v_user_id, v_session_id, 'signout', now());

  return true;
end;
$$;

revoke execute on function public.end_session() from public, anon;
grant execute on function public.end_session() to authenticated;

-- 9. admin_unlock_student()
create or replace function public.admin_unlock_student(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Unlock profile and clear pending flags
  update public.profiles
  set is_locked = false,
      lock_pending = false,
      locked_at = null
  where id = p_user_id;

  -- Clear revocation on current sessions
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

revoke execute on function public.admin_unlock_student(uuid) from public, anon;
grant execute on function public.admin_unlock_student(uuid) to authenticated;

-- 10. admin_student_session_audit()
create or replace function public.admin_student_session_audit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_locked boolean;
  v_locked_at timestamptz;
  v_live_sessions_count int;
  v_events jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select is_locked, locked_at into v_is_locked, v_locked_at
  from public.profiles
  where id = p_user_id;

  select count(*) into v_live_sessions_count
  from public.device_sessions
  where user_id = p_user_id
    and revoked_at is null
    and last_seen_at >= (now() - interval '5 minutes');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event', se.event,
        'created_at', se.created_at
      )
    ),
    '[]'::jsonb
  ) into v_events
  from (
    select event, created_at
    from public.session_events
    where user_id = p_user_id
    order by created_at desc
    limit 10
  ) se;

  return jsonb_build_object(
    'is_locked', coalesce(v_is_locked, false),
    'locked_at', v_locked_at,
    'live_sessions_count', v_live_sessions_count,
    'recent_events', v_events
  );
end;
$$;

revoke execute on function public.admin_student_session_audit(uuid) from public, anon;
grant execute on function public.admin_student_session_audit(uuid) to authenticated;
