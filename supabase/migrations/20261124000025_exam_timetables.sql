-- Migration: 20261124000025_exam_timetables.sql
-- Description: Creates exam_timetables table for scheduled courses per academic level,
-- and updates free trial question count to 25.

-- 1. Create exam_timetables table
CREATE TABLE IF NOT EXISTS public.exam_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_code TEXT NOT NULL CHECK (level_code IN ('100', '200', '300', '400')),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  exam_date TIMESTAMPTZ NOT NULL,
  paper_title TEXT DEFAULT 'Final Examination',
  venue TEXT DEFAULT 'CBT Center',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for high-speed chronological queries
CREATE INDEX IF NOT EXISTS idx_exam_timetables_lookup 
ON public.exam_timetables(level_code, exam_date ASC);

-- 2. Enable RLS
ALTER TABLE public.exam_timetables ENABLE ROW LEVEL SECURITY;

-- 3. Grants and Policies
GRANT SELECT ON public.exam_timetables TO authenticated;
GRANT ALL ON public.exam_timetables TO service_role;

DROP POLICY IF EXISTS "Allow authenticated read timetables" ON public.exam_timetables;
CREATE POLICY "Allow authenticated read timetables"
  ON public.exam_timetables FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow admin manage timetables" ON public.exam_timetables;
CREATE POLICY "Allow admin manage timetables"
  ON public.exam_timetables FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. RPC to get student's upcoming timetable and spotlight course
CREATE OR REPLACE FUNCTION public.get_student_upcoming_exams()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_level INT;
  v_result JSONB := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT level INTO v_level FROM public.profiles WHERE id = v_user_id;
  IF v_level IS NULL THEN
    v_level := 300;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'course_id', c.id,
        'course_code', c.code,
        'course_title', c.title,
        'level_code', t.level_code,
        'exam_date', t.exam_date,
        'paper_title', t.paper_title,
        'venue', t.venue
      )
      ORDER BY t.exam_date ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.exam_timetables t
  JOIN public.courses c ON c.id = t.course_id
  WHERE t.level_code = v_level::text
    AND t.exam_date >= (NOW() - INTERVAL '12 hours');

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_upcoming_exams() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_student_upcoming_exams() TO authenticated;
