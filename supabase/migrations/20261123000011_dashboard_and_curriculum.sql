-- ==============================================================================
-- NURSING PREP: DYNAMIC CURRICULUM, COURSES & CBT STATS ENGINE
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Ensure RLS policies permit authenticated users to read courses and academic levels
ALTER TABLE IF EXISTS public.academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read academic_levels" ON public.academic_levels;
CREATE POLICY "Allow authenticated read academic_levels"
  ON public.academic_levels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read courses" ON public.courses;
CREATE POLICY "Allow authenticated read courses"
  ON public.courses FOR SELECT TO authenticated USING (is_active = true);

-- 2. Seed Academic Levels (200, 300, 400) if not present
INSERT INTO public.academic_levels (name, code, description, is_active)
VALUES
  ('Level 200', '200', 'Foundations and fundamental nursing principles', true),
  ('Level 300', '300', 'Intermediate clinical nursing, Med-Surg, and Pharmacology', true),
  ('Level 400', '400', 'Advanced specialized nursing, Maternal-Child, and Public Health', true)
ON CONFLICT (name) DO UPDATE 
SET code = EXCLUDED.code, is_active = true;

-- 3. Seed Core Nursing Courses linked to Levels
DO $$
DECLARE
  lvl200_id UUID;
  lvl300_id UUID;
  lvl400_id UUID;
BEGIN
  SELECT id INTO lvl200_id FROM public.academic_levels WHERE code = '200' LIMIT 1;
  SELECT id INTO lvl300_id FROM public.academic_levels WHERE code = '300' LIMIT 1;
  SELECT id INTO lvl400_id FROM public.academic_levels WHERE code = '400' LIMIT 1;

  -- Level 200 Courses
  IF lvl200_id IS NOT NULL THEN
    INSERT INTO public.courses (level_id, title, code, description, is_active)
    VALUES
      (lvl200_id, 'Foundations of Nursing', 'NUR 201', 'Core vital signs, asepsis, nursing process, ethics, and basic clinical skills.', true),
      (lvl200_id, 'Anatomy & Physiology for Nurses', 'ANA 202', 'Cardiovascular, respiratory, neurological, and renal physiological systems.', true)
    ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  END IF;

  -- Level 300 Courses
  IF lvl300_id IS NOT NULL THEN
    INSERT INTO public.courses (level_id, title, code, description, is_active)
    VALUES
      (lvl300_id, 'Medical-Surgical Nursing I & II', 'NUR 301', 'Fluid & electrolytes, endocrine, perioperative, cardiovascular, and emergency nursing care.', true),
      (lvl300_id, 'Pharmacology & Therapeutics', 'PHA 302', 'Drug classifications, pharmacokinetics, IV flow rates, dosage calculations, and adverse effects.', true)
    ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  END IF;

  -- Level 400 Courses
  IF lvl400_id IS NOT NULL THEN
    INSERT INTO public.courses (level_id, title, code, description, is_active)
    VALUES
      (lvl400_id, 'Maternal & Child Health Nursing', 'NUR 305', 'Antepartum care, labor stages, fetal distress, neonatal resuscitation, and pediatrics.', true),
      (lvl400_id, 'Community & Public Health Nursing', 'NUR 401', 'Epidemiology, Primary Health Care (PHC), immunization cold chain, and biostatistics.', true),
      (lvl400_id, 'Mental Health & Psychiatric Nursing', 'NUR 403', 'Therapeutic communication, mood disorders, schizophrenia, and psychopharmacology.', true)
    ON CONFLICT (level_id, code) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  END IF;
END $$;

-- 4. Dynamic Dashboard Stats RPC (Pure Server Truth)
CREATE OR REPLACE FUNCTION public.get_student_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_attempts_count INT := 0;
  v_total_questions INT := 0;
  v_total_score INT := 0;
  v_overall_accuracy NUMERIC := 0;
  v_streak INT := 0;
  v_readiness INT := 0;
  v_recent_sessions JSONB := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Compute aggregated attempt totals
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(total), 0),
    COALESCE(SUM(score), 0)
  INTO v_attempts_count, v_total_questions, v_total_score
  FROM public.exam_attempts
  WHERE user_id = v_user_id
    AND submitted_at IS NOT NULL;

  IF v_total_questions > 0 THEN
    v_overall_accuracy := ROUND((v_total_score::numeric / v_total_questions::numeric) * 100, 1);
    v_readiness := LEAST(100, ROUND((v_overall_accuracy * 0.7) + (LEAST(v_total_questions, 200)::numeric / 200.0 * 30.0)));
  END IF;

  -- Compute active streak days
  WITH user_dates AS (
    SELECT DISTINCT DATE(submitted_at AT TIME ZONE 'UTC') AS d
    FROM public.exam_attempts
    WHERE user_id = v_user_id
      AND submitted_at IS NOT NULL
    ORDER BY d DESC
  )
  SELECT COALESCE(COUNT(*), 0) INTO v_streak
  FROM (
    SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) as rn
    FROM user_dates
    WHERE d >= (CURRENT_DATE - INTERVAL '30 days')
  ) sub;

  -- Fetch 5 most recent completed sessions
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  INTO v_recent_sessions
  FROM (
    SELECT
      id,
      score,
      total,
      ROUND((score::numeric / total::numeric) * 100) AS percentage,
      created_at,
      submitted_at
    FROM public.exam_attempts
    WHERE user_id = v_user_id
      AND submitted_at IS NOT NULL
    ORDER BY submitted_at DESC
    LIMIT 5
  ) sub;

  RETURN jsonb_build_object(
    'attempts_count', v_attempts_count,
    'total_questions', v_total_questions,
    'overall_accuracy', v_overall_accuracy,
    'streak_days', v_streak,
    'readiness_score', v_readiness,
    'recent_sessions', v_recent_sessions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_dashboard_stats() TO authenticated;
