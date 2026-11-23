-- Migration: 20261123000016_security_and_rls_hardening.sql

-- 1. Ensure table-level SELECT on courses and academic_levels for authenticated users
grant select on public.academic_levels to authenticated;
grant select on public.courses to authenticated;
grant select on public.questions to authenticated;

-- 2. Restrict unlock_after_payment exclusively to service_role (prevent client replay privilege escalation)
revoke execute on function public.unlock_after_payment(uuid, uuid) from authenticated, public, anon;
grant execute on function public.unlock_after_payment(uuid, uuid) to service_role;

-- 3. Restrict has_exam_in_progress to authenticated users only
revoke all on function public.has_exam_in_progress(uuid) from public, anon;
grant execute on function public.has_exam_in_progress(uuid) to authenticated;

-- 4. Fix admin_reset_student_attempts: drop non-existent exam_responses reference
create or replace function public.admin_reset_student_attempts(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  delete from public.exam_attempts
  where user_id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.admin_reset_student_attempts(uuid) from public, anon;
grant execute on function public.admin_reset_student_attempts(uuid) to authenticated;

-- 5. Harden get_exam_questions to strictly enforce account lockouts (prevent client-side bypass)
drop function if exists public.get_exam_questions(int);
drop function if exists public.get_exam_questions(integer);
drop function if exists public.get_exam_questions();

create or replace function public.get_exam_questions(p_count int default 20)
returns table (
  id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  difficulty text,
  topic text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_level int;
  v_is_active boolean;
  v_is_locked boolean;
  v_limit int := least(greatest(coalesce(p_count, 20), 1), 100);
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select level, is_active, coalesce(is_locked, false)
  into v_level, v_is_active, v_is_locked
  from public.profiles
  where profiles.id = v_user_id;

  if v_is_locked then
    raise exception 'ACCOUNT_LOCKED';
  end if;

  if not v_is_active then
    raise exception 'Active membership required';
  end if;

  if v_level is null then
    raise exception 'Student level must be set before starting exam';
  end if;

  return query
  select
    q.id,
    q.question_text,
    q.option_a,
    q.option_b,
    q.option_c,
    q.option_d,
    q.difficulty,
    q.topic
  from public.questions q
  join public.courses c on c.id = q.course_id
  join public.academic_levels al on al.id = c.level_id
  where q.status = 'approved'
    and al.code = v_level::text
  order by random()
  limit v_limit;
end;
$$;

revoke execute on function public.get_exam_questions(int) from public, anon;
grant execute on function public.get_exam_questions(int) to authenticated;
