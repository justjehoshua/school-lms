-- 004: server-side marking. Students call this instead of inserting rows, so answer keys never leave the database.

create or replace function submit_exercise(p_exercise_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ex exercises%rowtype;
  q record;
  ans text;
  sub_id uuid;
  total numeric := 0;
  max_total numeric := 0;
  needs_review boolean := false;
  per jsonb := '{}'::jsonb;
  ok boolean;
  released boolean;
  accepted jsonb;
begin
  if not is_student() then raise exception 'Only students can submit exercises.' using errcode = '42501'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object.'; end if;

  select * into ex from exercises where id = p_exercise_id and is_published and school_id = current_school_id();
  if not found or not can_read_lesson(ex.lesson_id) then
    raise exception 'This exercise is not available.' using errcode = '42501';
  end if;
  if exists (select 1 from exercise_submissions where exercise_id = ex.id and student_id = auth.uid()) then
    raise exception 'You have already submitted this exercise.';
  end if;

  for q in
    select eq.id, eq.qtype, eq.points, k.correct_answer, k.explanation
    from exercise_questions eq left join exercise_question_keys k on k.question_id = eq.id
    where eq.exercise_id = ex.id
  loop
    max_total := max_total + q.points;
    ans := lower(btrim(coalesce(p_answers ->> q.id::text, '')));
    if q.qtype = 'short_answer' then
      needs_review := true;
      per := per || jsonb_build_object(q.id::text, jsonb_build_object('correct', null, 'points', 0, 'explanation', q.explanation));
    else
      accepted := q.correct_answer;
      ok := ans <> '' and lower(btrim(accepted #>> '{}')) = ans;
      if ok then total := total + q.points; end if;
      per := per || jsonb_build_object(q.id::text, jsonb_build_object(
        'correct', ok, 'points', case when ok then q.points else 0 end, 'explanation', q.explanation));
    end if;
  end loop;

  insert into exercise_submissions (school_id, exercise_id, student_id, answers, status)
  values (ex.school_id, ex.id, auth.uid(), p_answers,
          case when needs_review then 'needs_review'::submission_status else 'marked'::submission_status end)
  returning id into sub_id;

  released := (ex.feedback = 'immediate' and not needs_review);
  insert into exercise_results (submission_id, school_id, score, max_score, per_question, released)
  values (sub_id, ex.school_id, total, max_total, per, released);

  if released then
    return jsonb_build_object('submission_id', sub_id, 'released', true, 'score', total, 'max_score', max_total, 'per_question', per);
  end if;
  return jsonb_build_object('submission_id', sub_id, 'released', false);
end $$;
grant execute on function submit_exercise(uuid, jsonb) to authenticated;
revoke execute on function submit_exercise(uuid, jsonb) from anon, public;

-- Teacher finishes manual marking: sets points per short-answer question and releases (or holds) the result.
create or replace function review_submission(p_submission uuid, p_points jsonb, p_release boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  s exercise_submissions%rowtype;
  r exercise_results%rowtype;
  k text; v numeric; per jsonb; total numeric := 0; item jsonb;
begin
  select * into s from exercise_submissions where id = p_submission;
  if not found then raise exception 'Submission not found.'; end if;
  if not exists (select 1 from exercises e where e.id = s.exercise_id and can_manage_lesson(e.lesson_id)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select * into r from exercise_results where submission_id = p_submission;
  per := r.per_question;
  for k, item in select * from jsonb_each(per) loop
    if p_points ? k then
      v := least((p_points ->> k)::numeric, (select points from exercise_questions where id = k::uuid));
      per := jsonb_set(per, array[k], item || jsonb_build_object('points', greatest(v, 0), 'correct', v > 0));
    end if;
  end loop;
  select coalesce(sum((value ->> 'points')::numeric), 0) into total from jsonb_each(per);
  update exercise_results set per_question = per, score = total, released = p_release where submission_id = p_submission;
  update exercise_submissions set status = 'marked' where id = p_submission;
end $$;
grant execute on function review_submission(uuid, jsonb, boolean) to authenticated;
revoke execute on function review_submission(uuid, jsonb, boolean) from anon, public;
