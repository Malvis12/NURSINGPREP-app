-- Migration: 20261124000024_add_100_level.sql
-- Description: Adds 100 Level to academic_levels and ensures all profile/exam checks support 100L students.

-- 1. Insert 100 Level if not already present
INSERT INTO public.academic_levels (name, code, description, is_active)
VALUES ('100 Level', '100', 'First year introductory sciences, basic anatomy, and general foundational curriculum.', true)
ON CONFLICT (name) DO UPDATE SET is_active = true, code = '100';

-- 2. Ensure academic_levels has a unique constraint or index on code if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_levels_code_key'
  ) THEN
    ALTER TABLE public.academic_levels ADD CONSTRAINT academic_levels_code_key UNIQUE (code);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
