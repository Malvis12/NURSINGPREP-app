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

-- 5. Harden get_exam_questions to strictly enforce account lockouts & create exam_attempts
drop function if exists public.get_exam_questions(int);
drop function if exists public.get_exam_questions(integer);
drop function if exists public.get_exam_questions();

create or replace function public.get_exam_questions(p_count int default 20)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
  v_level int;
  v_is_active boolean;
  v_is_locked boolean;
  v_attempt_id uuid;
  v_question_ids uuid[];
  v_questions jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select level, is_active, coalesce(is_locked, false)
  into v_level, v_is_active, v_is_locked
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Unauthorized';
  end if;

  if v_is_locked then
    raise exception 'ACCOUNT_LOCKED';
  end if;

  if not v_is_active then
    raise exception 'Active membership required';
  end if;

  if v_level is null then
    raise exception 'Student level not set';
  end if;

  -- Cap p_count between 1 and 100
  v_count := least(greatest(coalesce(p_count, 20), 1), 100);

  -- Pick v_count random approved questions for the student's academic level
  select
    coalesce(array_agg(q.id), '{}'),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'topic', q.topic,
        'question_text', q.question_text,
        'option_a', q.option_a,
        'option_b', q.option_b,
        'option_c', q.option_c,
        'option_d', q.option_d
      )
    ), '[]'::jsonb)
  into v_question_ids, v_questions
  from (
    select q.id, q.topic, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
    from public.questions q
    join public.courses c on c.id = q.course_id
    join public.academic_levels al on al.id = c.level_id
    where q.status = 'approved'
      and al.code = v_level::text
    order by random()
    limit v_count
  ) q;

  -- If zero eligible questions: raise stable error before attempt row is created
  if coalesce(array_length(v_question_ids, 1), 0) = 0 then
    raise exception 'NO_QUESTIONS_FOR_LEVEL';
  end if;

  insert into public.exam_attempts (user_id, question_ids, total)
  values (v_user_id, v_question_ids, coalesce(array_length(v_question_ids, 1), 0))
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_exam_questions(int) from public, anon;
grant execute on function public.get_exam_questions(int) to authenticated;
