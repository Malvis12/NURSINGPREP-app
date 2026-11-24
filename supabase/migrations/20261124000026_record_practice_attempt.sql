-- Migration: 20261124000026_record_practice_attempt.sql
-- Description: Records a completed interactive practice/tutor session into exam_attempts,
-- ensuring free trial quota is accurately tracked and practice history is visible in dashboard analytics.

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
    created_at,
    submitted_at
  )
  VALUES (
    v_user_id,
    p_question_ids,
    p_answers,
    p_score,
    p_total,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_practice_attempt(uuid[], jsonb, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_practice_attempt(uuid[], jsonb, int, int) TO authenticated;
