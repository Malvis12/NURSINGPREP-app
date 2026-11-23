-- Migration: 20261123000019_practice_mode_questions.sql
-- Adds get_practice_questions RPC which returns correct_answer and explanation for interactive Practice (Tutor) Mode.
-- Exam mode RPC (get_exam_questions) continues to withhold answers until submission.

drop function if exists public.get_practice_questions(int, uuid);
drop function if exists public.get_practice_questions(int);

create or replace function public.get_practice_questions(p_count int default 20, p_course_id uuid default null)
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

  -- Free trial check
  select count(*) into v_submitted_count
  from public.exam_attempts
  where user_id = v_user_id
    and submitted_at is not null;

  if not v_is_active and v_submitted_count >= 1 then
    raise exception 'TRIAL_EXHAUSTED';
  end if;

  -- Limit between 1 and 100
  v_count := least(greatest(coalesce(p_count, 20), 1), 100);

  -- Pick questions for practice mode including correct_answer and explanation
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'topic', q.topic,
        'question_text', q.question_text,
        'option_a', q.option_a,
        'option_b', q.option_b,
        'option_c', q.option_c,
        'option_d', q.option_d,
        'correct_answer', q.correct_answer,
        'explanation', q.explanation
      )
    ), '[]'::jsonb)
  into v_questions
  from (
    select q.id, q.topic, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation
    from public.questions q
    join public.courses c on c.id = q.course_id
    join public.academic_levels al on al.id = c.level_id
    where q.status = 'approved'
      and al.code = v_level::text
      and (p_course_id is null or q.course_id = p_course_id)
    order by random()
    limit v_count
  ) q;

  if jsonb_array_length(v_questions) = 0 then
    raise exception 'NO_QUESTIONS_FOR_LEVEL';
  end if;

  return jsonb_build_object(
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_practice_questions(int, uuid) from public, anon;
grant execute on function public.get_practice_questions(int, uuid) to authenticated;
