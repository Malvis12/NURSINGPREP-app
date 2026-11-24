-- Migration: 20261124000027_leaderboard.sql
-- Description: Adds leaderboard_settings table, mode column on exam_attempts,
-- and level-isolated Timed CBT leaderboard RPCs.

-- 1. Add mode column to exam_attempts to cleanly distinguish Timed CBT from Tutor Mode
ALTER TABLE public.exam_attempts
ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'timed';

-- Update record_practice_attempt to tag rows as 'tutor'
CREATE OR REPLACE FUNCTION public.record_practice_attempt(
  p_question_ids uuid[],
  p_answers jsonb,
  p_score int,
  p_total int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.exam_attempts (
    user_id,
    question_ids,
    answers,
    score,
    total,
    mode,
    created_at,
    submitted_at
  )
  VALUES (
    v_user_id,
    p_question_ids,
    p_answers,
    p_score,
    p_total,
    'tutor',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

-- 2. Create leaderboard_settings table for configurable prize text
CREATE TABLE IF NOT EXISTS public.leaderboard_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  prize_text TEXT NOT NULL DEFAULT 'Top-ranked student at the end of exams wins a special prize.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.leaderboard_settings (id, prize_text)
VALUES (1, 'Top-ranked student at the end of exams wins a special prize.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.leaderboard_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.leaderboard_settings TO authenticated;
GRANT ALL ON public.leaderboard_settings TO service_role;

DROP POLICY IF EXISTS "Allow authenticated read leaderboard_settings" ON public.leaderboard_settings;
CREATE POLICY "Allow authenticated read leaderboard_settings"
  ON public.leaderboard_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin manage leaderboard_settings" ON public.leaderboard_settings;
CREATE POLICY "Allow admin manage leaderboard_settings"
  ON public.leaderboard_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. RPC: get_level_leaderboard(p_level_code)
-- Students strictly see their own level; admins can pass any level_code ('100','200','300','400').
CREATE OR REPLACE FUNCTION public.get_level_leaderboard(p_level_code TEXT DEFAULT NULL)
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

  SELECT prize_text INTO v_prize_text FROM public.leaderboard_settings WHERE id = 1;
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
    'entries', v_entries,
    'my_rank', v_my_rank
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_level_leaderboard(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_level_leaderboard(TEXT) TO authenticated;

-- 4. RPC: admin_update_leaderboard_prize
CREATE OR REPLACE FUNCTION public.admin_update_leaderboard_prize(p_prize_text TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.leaderboard_settings (id, prize_text, updated_at)
  VALUES (1, COALESCE(NULLIF(TRIM(p_prize_text), ''), 'Top-ranked student at the end of exams wins a special prize.'), NOW())
  ON CONFLICT (id) DO UPDATE
  SET prize_text = EXCLUDED.prize_text,
      updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_leaderboard_prize(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_leaderboard_prize(TEXT) TO authenticated;
