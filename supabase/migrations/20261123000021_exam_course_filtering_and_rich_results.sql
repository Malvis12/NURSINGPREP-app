-- Migration: 20261123000021_exam_course_filtering_and_rich_results.sql
-- 1. Updates get_exam_questions to accept p_course_id and strictly filter questions to selected course.
-- 2. Updates get_practice_questions to accept p_course_id and strictly filter questions to selected course.
-- 3. Updates grade_attempt and get_attempt_result to return full question text, options (A-D), chosen, correct_answer, and explanation for high-fidelity solutions review.

-- ============================================================================
-- 1. get_exam_questions(p_count int, p_course_id uuid)
-- ============================================================================
drop function if exists public.get_exam_questions(int, uuid);
drop function if exists public.get_exam_questions(int);
drop function if exists public.get_exam_questions(integer);
drop function if exists public.get_exam_questions();

create or replace function public.get_exam_questions(
  p_count int default 20,
  p_course_id uuid default null
)
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

  -- Pick v_count random approved questions for the student's academic level and optional course
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
      and (p_course_id is null or q.course_id = p_course_id)
    order by random()
    limit v_count
  ) q;

  -- If zero eligible questions: raise stable error before attempt row is created
  if coalesce(array_length(v_question_ids, 1), 0) = 0 then
    raise exception 'NO_QUESTIONS_FOR_LEVEL';
  end if;

  -- Insert new exam_attempt row
  insert into public.exam_attempts (user_id, question_ids, answers)
  values (v_user_id, v_question_ids, '{}'::jsonb)
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', v_questions
  );
end;
$$;

revoke all on function public.get_exam_questions(int, uuid) from public, anon;
grant execute on function public.get_exam_questions(int, uuid) to authenticated;

-- ============================================================================
-- 2. get_practice_questions(p_count int, p_course_id uuid)
-- ============================================================================
drop function if exists public.get_practice_questions(int, uuid);
drop function if exists public.get_practice_questions(int);

create or replace function public.get_practice_questions(
  p_count int default 20,
  p_course_id uuid default null
)
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

  v_count := least(greatest(coalesce(p_count, 20), 1), 100);

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

-- ============================================================================
-- 3. grade_attempt with rich question data for detailed solutions
-- ============================================================================
create or replace function public.grade_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_ids uuid[];
  v_submitted_at timestamptz;
  v_created_at timestamptz;
  v_total int;
  v_score int := 0;
  v_results jsonb := '[]'::jsonb;
  v_answers jsonb;
  v_qid uuid;
  v_q record;
  v_chosen text;
  v_is_correct boolean;
  v_late boolean := false;
  v_auto_submitted boolean := false;
begin
  select question_ids, answers, submitted_at, created_at, late, auto_submitted
  into v_question_ids, v_answers, v_submitted_at, v_created_at, v_late, v_auto_submitted
  from public.exam_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  if v_late or (now() > v_created_at + interval '7200 seconds' + interval '60 seconds') then
    v_late := true;
  end if;

  v_answers := coalesce(v_answers, '{}'::jsonb);
  v_total := coalesce(array_length(v_question_ids, 1), 0);

  if v_total > 0 then
    for i in 1 .. v_total loop
      v_qid := v_question_ids[i];
      select id, topic, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
      into v_q
      from public.questions
      where id = v_qid;

      if found then
        v_chosen := v_answers ->> v_qid::text;
        v_is_correct := (v_chosen is not null and upper(trim(v_chosen)) = upper(trim(v_q.correct_answer)));
        if v_is_correct then
          v_score := v_score + 1;
        end if;

        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'id', v_q.id,
            'topic', v_q.topic,
            'question_text', v_q.question_text,
            'option_a', v_q.option_a,
            'option_b', v_q.option_b,
            'option_c', v_q.option_c,
            'option_d', v_q.option_d,
            'chosen', v_chosen,
            'correct_answer', v_q.correct_answer,
            'explanation', v_q.explanation
          )
        );
      end if;
    end loop;
  end if;

  update public.exam_attempts
  set score = v_score,
      total = v_total,
      submitted_at = coalesce(v_submitted_at, now()),
      late = v_late
  where id = p_attempt_id;

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'late', v_late,
    'auto_submitted', v_auto_submitted,
    'results', v_results
  );
end;
$$;

revoke all on function public.grade_attempt(uuid) from public, anon, authenticated;

-- ============================================================================
-- 4. get_attempt_result with rich question data
-- ============================================================================
create or replace function public.get_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_user_id uuid;
  v_question_ids uuid[];
  v_submitted_at timestamptz;
  v_score int;
  v_total int;
  v_late boolean;
  v_auto_submitted boolean;
  v_answers jsonb;
  v_results jsonb := '[]'::jsonb;
  v_qid uuid;
  v_q record;
  v_chosen text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select user_id, question_ids, answers, submitted_at, score, total, late, auto_submitted
  into v_attempt_user_id, v_question_ids, v_answers, v_submitted_at, v_score, v_total, v_late, v_auto_submitted
  from public.exam_attempts
  where id = p_attempt_id;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  if v_attempt_user_id <> auth.uid() then
    raise exception 'Attempt does not belong to user';
  end if;

  if v_submitted_at is null then
    raise exception 'Exam attempt not yet submitted';
  end if;

  v_answers := coalesce(v_answers, '{}'::jsonb);
  v_total := coalesce(array_length(v_question_ids, 1), 0);

  if v_total > 0 then
    for i in 1 .. v_total loop
      v_qid := v_question_ids[i];
      select id, topic, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation
      into v_q
      from public.questions
      where id = v_qid;

      if found then
        v_chosen := v_answers ->> v_qid::text;
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'id', v_q.id,
            'topic', v_q.topic,
            'question_text', v_q.question_text,
            'option_a', v_q.option_a,
            'option_b', v_q.option_b,
            'option_c', v_q.option_c,
            'option_d', v_q.option_d,
            'chosen', v_chosen,
            'correct_answer', v_q.correct_answer,
            'explanation', v_q.explanation
          )
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'score', coalesce(v_score, 0),
    'total', v_total,
    'late', coalesce(v_late, false),
    'auto_submitted', coalesce(v_auto_submitted, false),
    'results', v_results
  );
end;
$$;

revoke all on function public.get_attempt_result(uuid) from public, anon;
grant execute on function public.get_attempt_result(uuid) to authenticated;
