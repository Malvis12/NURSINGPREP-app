-- Migration: 20261123000020_trial_save_and_submit.sql
-- Allows free trial users (users who have an unsubmitted attempt granted by get_exam_questions)
-- to call save_answers and submit_exam without being blocked by "Active membership required".
-- Active membership or being within the legitimate 1 free trial attempt is verified by checking attempt ownership.

-- 1. Update save_answers
create or replace function public.save_answers(p_attempt_id uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_user_id uuid;
  v_question_ids uuid[];
  v_submitted_at timestamptz;
  v_created_at timestamptz;
  v_answers jsonb;
  v_last_saved_at timestamptz;
  v_recent_save_count int;
  v_is_active boolean := false;
  v_submitted_count int := 0;
  v_key text;
  v_val text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select is_active into v_is_active
  from public.profiles
  where id = auth.uid();

  -- Verify exam attempt ownership first
  select user_id, question_ids, submitted_at, created_at, answers, last_saved_at, recent_save_count
  into v_attempt_user_id, v_question_ids, v_submitted_at, v_created_at, v_answers, v_last_saved_at, v_recent_save_count
  from public.exam_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  if v_attempt_user_id <> auth.uid() then
    raise exception 'Attempt does not belong to user';
  end if;

  if v_submitted_at is not null then
    raise exception 'Exam attempt already submitted';
  end if;

  -- If not active, check if they have already submitted any prior attempts (trial exhausted)
  if not coalesce(v_is_active, false) then
    select count(*) into v_submitted_count
    from public.exam_attempts
    where user_id = auth.uid()
      and submitted_at is not null;

    if v_submitted_count >= 1 then
      raise exception 'Active membership required';
    end if;
  end if;

  -- Deadline check: now() <= created_at + 7200s (up to 2h) + 30s grace, else raise
  if now() > v_created_at + interval '7200 seconds' + interval '30 seconds' then
    raise exception 'Submission deadline passed';
  end if;

  -- Rate limit check: max 10 saves within 2 seconds
  if v_last_saved_at is not null and (now() - v_last_saved_at) <= interval '2 seconds' then
    if v_recent_save_count >= 10 then
      raise exception 'Rate limit exceeded';
    end if;
    v_recent_save_count := v_recent_save_count + 1;
  else
    v_recent_save_count := 1;
  end if;

  v_answers := coalesce(v_answers, '{}'::jsonb);

  if p_changes is not null and jsonb_typeof(p_changes) = 'object' then
    for v_key, v_val in select * from jsonb_each_text(p_changes) loop
      if v_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        if (v_key::uuid = any(v_question_ids)) and (lower(trim(v_val)) in ('a', 'b', 'c', 'd')) then
          v_answers := jsonb_set(v_answers, array[v_key], to_jsonb(v_val));
        end if;
      end if;
    end loop;
  end if;

  update public.exam_attempts
  set
    answers = v_answers,
    last_saved_at = now(),
    recent_save_count = v_recent_save_count
  where id = p_attempt_id;

  return jsonb_build_object(
    'success', true,
    'saved_at', now()
  );
end;
$$;

revoke all on function public.save_answers(uuid, jsonb) from public, anon;
grant execute on function public.save_answers(uuid, jsonb) to authenticated;

-- 2. Update submit_exam
create or replace function public.submit_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt_user_id uuid;
  v_question_ids uuid[];
  v_submitted_at timestamptz;
  v_created_at timestamptz;
  v_saved_answers jsonb;
  v_merged_answers jsonb;
  v_is_active boolean := false;
  v_submitted_count int := 0;
  v_key text;
  v_val text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select is_active into v_is_active
  from public.profiles
  where id = auth.uid();

  select user_id, question_ids, submitted_at, created_at, answers
  into v_attempt_user_id, v_question_ids, v_submitted_at, v_created_at, v_saved_answers
  from public.exam_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Exam attempt not found';
  end if;

  if v_attempt_user_id <> auth.uid() then
    raise exception 'Attempt does not belong to user';
  end if;

  if v_submitted_at is not null then
    raise exception 'Exam attempt already submitted';
  end if;

  -- Free trial check: If user is not active, allow submission of their 1 free attempt
  if not coalesce(v_is_active, false) then
    select count(*) into v_submitted_count
    from public.exam_attempts
    where user_id = auth.uid()
      and submitted_at is not null;

    if v_submitted_count >= 1 then
      raise exception 'Active membership required';
    end if;
  end if;

  -- Within grace period: merge p_answers into answers
  v_merged_answers := coalesce(v_saved_answers, '{}'::jsonb);
  if p_answers is not null and jsonb_typeof(p_answers) = 'object' then
    for v_key, v_val in select * from jsonb_each_text(p_answers) loop
      if v_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        if (v_key::uuid = any(v_question_ids)) and (lower(trim(v_val)) in ('a', 'b', 'c', 'd')) then
          v_merged_answers := jsonb_set(v_merged_answers, array[v_key], to_jsonb(v_val));
        end if;
      end if;
    end loop;
  end if;

  update public.exam_attempts
  set
    answers = v_merged_answers,
    submitted_at = now()
  where id = p_attempt_id;

  -- Grade and return results
  return public.grade_attempt(p_attempt_id);
end;
$$;

revoke all on function public.submit_exam(uuid, jsonb) from public, anon;
grant execute on function public.submit_exam(uuid, jsonb) to authenticated;
