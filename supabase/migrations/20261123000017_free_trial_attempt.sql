-- Migration: 20261123000017_free_trial_attempt.sql
-- Enables 1 full free trial exam attempt for any registered student before requiring Pro payment.
-- The trial attempt is ONLY consumed after submission (when submitted_at is not null).

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
  v_submitted_count int := 0;
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

  if v_level is null then
    raise exception 'Student level not set';
  end if;

  -- Count submitted exam attempts by this user
  select count(*) into v_submitted_count
  from public.exam_attempts
  where user_id = v_user_id
    and submitted_at is not null;

  -- Allow if user is active (Pro) OR if they have not yet submitted their 1 free trial attempt
  if not v_is_active and v_submitted_count >= 1 then
    raise exception 'TRIAL_EXHAUSTED';
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
