-- Migration: 20261123000013_admin_student_actions.sql

-- 1. admin_toggle_student_status: Allows admins to manually activate/deactivate student Pro status (for offline/bank transfer payments)
create or replace function public.admin_toggle_student_status(
  p_user_id uuid,
  p_is_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set is_active = p_is_active
  where id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.admin_toggle_student_status(uuid, boolean) from public, anon;
grant execute on function public.admin_toggle_student_status(uuid, boolean) to authenticated;

-- 2. admin_reset_student_attempts: Allows admins to reset exam/practice attempts for a student on demand
create or replace function public.admin_reset_student_attempts(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  -- Delete exam responses first then attempts
  delete from public.exam_responses
  where attempt_id in (
    select id from public.exam_attempts where user_id = p_user_id
  );

  delete from public.exam_attempts
  where user_id = p_user_id;

  return true;
end;
$$;

revoke execute on function public.admin_reset_student_attempts(uuid) from public, anon;
grant execute on function public.admin_reset_student_attempts(uuid) to authenticated;
