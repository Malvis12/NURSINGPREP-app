-- schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS academic_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT academic_levels_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID NOT NULL REFERENCES academic_levels(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT courses_code_unique_per_level UNIQUE (level_id, code),
  CONSTRAINT courses_title_unique_per_level UNIQUE (level_id, title)
);

CREATE TABLE IF NOT EXISTS question_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  original_filename TEXT,
  document_hash TEXT,
  mime_type TEXT,
  generation_model TEXT,
  total_requested INTEGER NOT NULL DEFAULT 0,
  total_generated INTEGER NOT NULL DEFAULT 0,
  batch_size INTEGER NOT NULL DEFAULT 10,
  generation_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  source_id UUID REFERENCES question_sources(id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  topic TEXT,
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS generation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES question_sources(id) ON DELETE CASCADE,
  batch_number INTEGER NOT NULL,
  requested_count INTEGER NOT NULL,
  generated_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (source_id, batch_number)
);

-- indexes
CREATE INDEX IF NOT EXISTS idx_courses_level_id ON courses(level_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_questions_course_id ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_source_id ON questions(source_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_sources_course_id ON question_sources(course_id);
CREATE INDEX IF NOT EXISTS idx_question_sources_created_at ON question_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_batches_source_id ON generation_batches(source_id);

-- policies
ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_batches ENABLE ROW LEVEL SECURITY;

-- This local administrator tool uses the service-role key only in the Node.js backend.
-- No policies grant public browser access. If direct authenticated access is later needed,
-- replace these with explicit authenticated/administrator policies and use an anon key only.
REVOKE ALL ON academic_levels FROM anon, authenticated;
REVOKE ALL ON courses FROM anon, authenticated;
REVOKE ALL ON question_sources FROM anon, authenticated;
REVOKE ALL ON questions FROM anon, authenticated;
REVOKE ALL ON generation_batches FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON TABLE academic_levels, courses, question_sources, questions, generation_batches TO service_role;

DROP POLICY IF EXISTS local_backend_access ON academic_levels;
CREATE POLICY local_backend_access ON academic_levels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS local_backend_access ON courses;
CREATE POLICY local_backend_access ON courses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS local_backend_access ON question_sources;
CREATE POLICY local_backend_access ON question_sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS local_backend_access ON questions;
CREATE POLICY local_backend_access ON questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS local_backend_access ON generation_batches;
CREATE POLICY local_backend_access ON generation_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
