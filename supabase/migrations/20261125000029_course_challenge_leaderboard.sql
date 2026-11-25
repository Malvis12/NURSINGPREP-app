-- Migration: 20261125000029_course_challenge_leaderboard.sql
-- Description: Adds course_id to exam_attempts and challenge_course_id to leaderboard_settings
-- so admins can run a course-specific leaderboard challenge with a prize.

-- 1. Add course_id to exam_attempts
ALTER TABLE public.exam_attempts
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_attempts_course_id ON public.exam_attempts(course_id);

-- 2. Add challenge_course_id to leaderboard_settings
ALTER TABLE public.leaderboard_settings
ADD COLUMN IF NOT EXISTS challenge_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- 3. Update get_exam_questions to save p_course_id into exam_attempts
CREATE OR REPLACE FUNCTION public.get_exam_questions(
  p_count int default 20,
  p_course_id uuid default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
  v_level int;
  v_is_active boolean;
  v_is_locked boolean;
  v_submitted_count int := 0;
  v_question_ids uuid[] := '{}';
  v_questions jsonb := '[]'::jsonb;
  v_attempt_id uuid;
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

  select count(*) into v_submitted_count
  from public.exam_attempts
  where user_id = v_user_id
    and submitted_at is not null;

  if not v_is_active and v_submitted_count >= 1 then
    raise exception 'TRIAL_EXHAUSTED: You have already used your 1 free trial exam. Please upgrade to continue.';
  end if;

  v_count := least(greatest(coalesce(p_count, 20), 1), 100);

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

  if array_length(v_question_ids, 1) is null or array_length(v_question_ids, 1) = 0 then
    raise exception 'NO_QUESTIONS_FOR_LEVEL: No approved questions available for your academic level/course yet.';
  end if;

  insert into public.exam_attempts (user_id, question_ids, answers, course_id, mode)
  values (v_user_id, v_question_ids, '{}'::jsonb, p_course_id, 'timed')
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', v_questions
  );
end;
$$;

-- 4. Update get_level_leaderboard to support optional p_course_id (or active challenge_course_id)
DROP FUNCTION IF EXISTS public.get_level_leaderboard(TEXT);
CREATE OR REPLACE FUNCTION public.get_level_leaderboard(
  p_level_code TEXT DEFAULT NULL,
  p_course_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_level INT;
  v_target_level TEXT;
  v_prize_text TEXT;
  v_challenge_course_id UUID;
  v_challenge_course_code TEXT;
  v_challenge_course_title TEXT;
  v_entries JSONB := '[]'::jsonb;
  v_my_rank JSONB := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT level INTO v_user_level FROM public.profiles WHERE id = v_user_id;
  IF v_user_level IS NULL THEN
    v_user_level := 300;
  END IF;

  IF p_level_code IS NOT NULL AND public.is_admin() THEN
    v_target_level := p_level_code;
  ELSE
    v_target_level := v_user_level::text;
  END IF;

  SELECT ls.prize_text, ls.challenge_course_id, c.code, c.title
  INTO v_prize_text, v_challenge_course_id, v_challenge_course_code, v_challenge_course_title
  FROM public.leaderboard_settings ls
  LEFT JOIN public.courses c ON c.id = ls.challenge_course_id
  WHERE ls.id = 1;

  IF v_prize_text IS NULL THEN
    v_prize_text := 'Top-ranked student at the end of exams wins a special prize.';
  END IF;

  WITH ranked AS (
    SELECT
      p.id AS user_id,
      COALESCE(NULLIF(TRIM(p.full_name), ''), 'Nursing Student') AS full_name,
      COALESCE(p.university, 'Wellspring University') AS university,
      COUNT(ea.id)::int AS exams_count,
      COALESCE(SUM(ea.total), 0)::int AS total_questions,
      COALESCE(SUM(ea.score), 0)::int AS total_correct,
      CASE
        WHEN COALESCE(SUM(ea.total), 0) > 0
        THEN ROUND((SUM(ea.score)::numeric / SUM(ea.total)::numeric) * 100, 1)
        ELSE 0
      END AS accuracy,
      ((COALESCE(SUM(ea.score), 0) * 10) + (COALESCE(SUM(ea.total), 0) * 2))::int AS points,
      ROW_NUMBER() OVER (
        ORDER BY
          ((COALESCE(SUM(ea.score), 0) * 10) + (COALESCE(SUM(ea.total), 0) * 2)) DESC,
          CASE WHEN COALESCE(SUM(ea.total), 0) > 0 THEN (SUM(ea.score)::numeric / SUM(ea.total)::numeric) ELSE 0 END DESC,
          COALESCE(SUM(ea.total), 0) DESC
      )::int AS rank
    FROM public.profiles p
    JOIN public.exam_attempts ea ON ea.user_id = p.id
    WHERE p.level::text = v_target_level
      AND p.is_active = true
      AND ea.submitted_at IS NOT NULL
      AND COALESCE(ea.mode, 'timed') = 'timed'
      AND (p_course_id IS NULL OR ea.course_id = p_course_id)
    GROUP BY p.id, p.full_name, p.university
    HAVING COALESCE(SUM(ea.total), 0) > 0
  )
  SELECT
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'rank', r.rank,
          'user_id', r.user_id,
          'full_name', r.full_name,
          'university', r.university,
          'exams_count', r.exams_count,
          'total_questions', r.total_questions,
          'total_correct', r.total_correct,
          'accuracy', r.accuracy,
          'points', r.points,
          'is_me', (r.user_id = v_user_id)
        )
        ORDER BY r.rank ASC
      ) FROM ranked r WHERE r.rank <= 25),
      '[]'::jsonb
    ),
    (SELECT jsonb_build_object(
      'rank', r.rank,
      'user_id', r.user_id,
      'full_name', r.full_name,
      'exams_count', r.exams_count,
      'total_questions', r.total_questions,
      'total_correct', r.total_correct,
      'accuracy', r.accuracy,
      'points', r.points
    ) FROM ranked r WHERE r.user_id = v_user_id LIMIT 1)
  INTO v_entries, v_my_rank;

  RETURN jsonb_build_object(
    'level_code', v_target_level,
    'prize_text', v_prize_text,
    'challenge_course_id', v_challenge_course_id,
    'challenge_course_code', v_challenge_course_code,
    'challenge_course_title', v_challenge_course_title,
    'entries', v_entries,
    'my_rank', v_my_rank
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_level_leaderboard(TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_level_leaderboard(TEXT, UUID) TO authenticated;

-- 5. Update admin_update_leaderboard_prize to also accept optional p_challenge_course_id
DROP FUNCTION IF EXISTS public.admin_update_leaderboard_prize(TEXT);
CREATE OR REPLACE FUNCTION public.admin_update_leaderboard_prize(
  p_prize_text TEXT,
  p_challenge_course_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.leaderboard_settings (id, prize_text, challenge_course_id, updated_at)
  VALUES (
    1,
    COALESCE(NULLIF(TRIM(p_prize_text), ''), 'Top-ranked student at the end of exams wins a special prize.'),
    p_challenge_course_id,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET prize_text = EXCLUDED.prize_text,
      challenge_course_id = EXCLUDED.challenge_course_id,
      updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_leaderboard_prize(TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_leaderboard_prize(TEXT, UUID) TO authenticated;
