-- Migration: 20261124000023_curriculum_catalog_rpc.sql
-- Description: Provides a high-performance, security-definer RPC get_curriculum_catalog()
-- to accurately count approved questions per course without client-side RLS blocking or PostgREST 1,000-row limits.

create or replace function public.get_curriculum_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'code', c.code,
        'description', coalesce(c.description, ''),
        'level_code', coalesce(al.code, '300'),
        'total_questions', coalesce(q_counts.total_approved, 0),
        'topics', coalesce(t_counts.topic_list, '[]'::jsonb)
      )
      order by c.code asc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.courses c
  left join public.academic_levels al on al.id = c.level_id
  -- Aggregated approved question count per course
  left join (
    select
      course_id,
      count(*)::int as total_approved
    from public.questions
    where status = 'approved'
    group by course_id
  ) q_counts on q_counts.course_id = c.id
  -- Aggregated distinct topics per course
  left join (
    select
      course_id,
      jsonb_agg(
        jsonb_build_object(
          'name', topic_name,
          'count', topic_count
        )
      ) as topic_list
    from (
      select
        course_id,
        coalesce(topic, 'General Practice') as topic_name,
        count(*)::int as topic_count
      from public.questions
      where status = 'approved'
      group by course_id, coalesce(topic, 'General Practice')
    ) sub_topics
    group by course_id
  ) t_counts on t_counts.course_id = c.id
  where c.is_active = true;

  return v_result;
end;
$$;

revoke all on function public.get_curriculum_catalog() from public, anon;
grant execute on function public.get_curriculum_catalog() to authenticated;
