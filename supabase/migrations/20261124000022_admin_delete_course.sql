-- Migration: 20261124000022_admin_delete_course.sql
-- Function to safely delete a course and cascade delete all its questions, question_sources, and exam attempt references.

create or replace function public.admin_delete_course(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_course_title text;
  v_course_code text;
  v_questions_count int := 0;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Verify admin role
  select role into v_role
  from public.profiles
  where id = v_user_id;

  if v_role <> 'admin' then
    raise exception 'Forbidden: Admin access required';
  end if;

  -- Check if course exists
  select title, code
  into v_course_title, v_course_code
  from public.courses
  where id = p_course_id;

  if not found then
    raise exception 'Course not found';
  end if;

  -- 1. Count & delete all questions belonging to this course
  select count(*) into v_questions_count
  from public.questions
  where course_id = p_course_id;

  delete from public.questions
  where course_id = p_course_id;

  -- 2. Delete any question sources for this course
  delete from public.question_sources
  where course_id = p_course_id;

  -- 3. Delete the course record itself
  delete from public.courses
  where id = p_course_id;

  return jsonb_build_object(
    'success', true,
    'course_id', p_course_id,
    'title', v_course_title,
    'code', v_course_code,
    'deleted_questions_count', v_questions_count
  );
end;
$$;

revoke all on function public.admin_delete_course(uuid) from public, anon;
grant execute on function public.admin_delete_course(uuid) to authenticated;
