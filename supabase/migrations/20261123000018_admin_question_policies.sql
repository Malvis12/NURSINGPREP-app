-- Migration: 20261123000018_admin_question_policies.sql
-- Grants table privileges and RLS policies for authenticated users and admins to view, insert, update and manage questions and courses.

-- 1. Table Grants
grant usage on schema public to authenticated;
grant select on public.academic_levels to authenticated;
grant select on public.courses to authenticated;
grant select on public.questions to authenticated;

grant all on public.courses to authenticated;
grant all on public.questions to authenticated;

-- 2. RLS Policies on academic_levels
drop policy if exists "Allow authenticated select on academic_levels" on public.academic_levels;
create policy "Allow authenticated select on academic_levels"
  on public.academic_levels
  for select
  to authenticated
  using (true);

-- 3. RLS Policies on courses
drop policy if exists "Allow authenticated select on courses" on public.courses;
create policy "Allow authenticated select on courses"
  on public.courses
  for select
  to authenticated
  using (true);

drop policy if exists "Allow admin manage courses" on public.courses;
create policy "Allow admin manage courses"
  on public.courses
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4. RLS Policies on questions
drop policy if exists "Allow authenticated select on questions" on public.questions;
create policy "Allow authenticated select on questions"
  on public.questions
  for select
  to authenticated
  using (true);

drop policy if exists "Allow admin manage questions" on public.questions;
create policy "Allow admin manage questions"
  on public.questions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
