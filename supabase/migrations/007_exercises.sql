-- 007: exercise authoring, marking and release.
-- Everything that touches answer keys runs inside the database, so keys never reach a student's browser.

-- Teacher saves an exercise and its questions in one all-or-nothing step.
-- p_questions = null means "change only the title, feedback mode and published flag".
create or replace function save_exercise(
  p_lesson uuid, p_exercise uuid, p_title text, p_feedback feedback_mode, p_published boolean, p_questions jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  ex_id uuid; school uuid; q jsonb; i int := 0; qid uuid; qt text; opts jsonb; corr text;
begin
  if not can_manage_lesson(p_lesson) then raise exception 'You are not allowed to edit this lesson.' using errcode = '42501'; end if;
  select school_id into school from lessons where id = p_lesson;
  if char_length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'Give the exercise a title.'; end if;

  if p_exercise is null then
    insert into exercises (school_id, lesson_id, title, feedback, is_published)
    values (school, p_lesson, btrim(p_title), p_feedback, p_published) returning id into ex_id;
  else
    select id into ex_id from exercises where id = p_exercise and lesson_id = p_lesson;
    if ex_id is null then raise exception 'Exercise not found.'; end if;
    update exercises set title = btrim(p_title), feedback = p_feedback, is_published = p_published where id = ex_id;
  end if;

  if p_questions is not null then
    if jsonb_typeof(p_questions) <> 'array' then raise exception 'Questions must be a list.'; end if;
    if exists (select 1 from exercise_submissions where exercise_id = ex_id) then
      raise exception 'This exercise already has submissions, so its questions can no longer be changed.';
    end if;
    delete from exercise_questions where exercise_id = ex_id;  -- answer keys are removed with them
    for q in select * from jsonb_array_elements(p_questions) loop
      qt := q ->> 'qtype';
      opts := q -> 'options';
      corr := q ->> 'correct_answer';
      if char_length(btrim(coalesce(q ->> 'prompt', ''))) = 0 then raise exception 'Question % has no text.', i + 1; end if;
      if qt = 'multiple_choice' then
        if jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) < 2 then raise exception 'Question % needs at least two options.', i + 1; end if;
        if corr is null or not (opts ? corr) then raise exception 'Question % needs a correct answer chosen from its options.', i + 1; end if;
      elsif qt = 'true_false' then
        if corr not in ('true', 'false') then raise exception 'Question % needs True or False selected.', i + 1; end if;
        opts := null;
      elsif qt = 'short_answer' then
        opts := null;
      else
        raise exception 'Question % has an unknown type.', i + 1;
      end if;
      insert into exercise_questions (exercise_id, school_id, position, qtype, prompt, options, points)
      values (ex_id, school, i, qt::question_type, btrim(q ->> 'prompt'), opts, coalesce((q ->> 'points')::numeric, 1))
      returning id into qid;
      insert into exercise_question_keys (question_id, school_id, correct_answer, explanation)
      values (qid, school, case when corr is null then null else to_jsonb(corr) end, nullif(btrim(coalesce(q ->> 'explanation', '')), ''));
      i := i + 1;
    end loop;
  end if;

  if p_published and not exists (select 1 from exercise_questions where exercise_id = ex_id) then
    raise exception 'Add at least one question before publishing.';
  end if;
  return ex_id;
end $$;
grant execute on function save_exercise(uuid, uuid, text, feedback_mode, boolean, jsonb) to authenticated;
revoke execute on function save_exercise(uuid, uuid, text, feedback_mode, boolean, jsonb) from anon, public;

-- Marking now also records the correct answer, which stays hidden until the result is released.
create or replace function submit_exercise(p_exercise_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ex exercises%rowtype; q record; ans text; sub_id uuid;
  total numeric := 0; max_total numeric := 0; needs_review boolean := false;
  per jsonb := '{}'::jsonb; ok boolean; is_released boolean;
begin
  if not is_student() then raise exception 'Only students can submit exercises.' using errcode = '42501'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object.'; end if;
  select * into ex from exercises where id = p_exercise_id and is_published and school_id = current_school_id();
  if not found or not can_read_lesson(ex.lesson_id) then raise exception 'This exercise is not available.' using errcode = '42501'; end if;
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
      per := per || jsonb_build_object(q.id::text, jsonb_build_object('correct', null, 'points', 0, 'explanation', q.explanation, 'correct_answer', q.correct_answer));
    else
      ok := ans <> '' and lower(btrim(q.correct_answer #>> '{}')) = ans;
      if ok then total := total + q.points; end if;
      per := per || jsonb_build_object(q.id::text, jsonb_build_object(
        'correct', coalesce(ok, false), 'points', case when ok then q.points else 0 end, 'explanation', q.explanation, 'correct_answer', q.correct_answer));
    end if;
  end loop;

  insert into exercise_submissions (school_id, exercise_id, student_id, answers, status)
  values (ex.school_id, ex.id, auth.uid(), p_answers, case when needs_review then 'needs_review'::submission_status else 'marked'::submission_status end)
  returning id into sub_id;

  is_released := (ex.feedback = 'immediate' and not needs_review);
  insert into exercise_results (submission_id, school_id, score, max_score, per_question, released)
  values (sub_id, ex.school_id, total, max_total, per, is_released);

  if is_released then
    return jsonb_build_object('submission_id', sub_id, 'released', true, 'score', total, 'max_score', max_total);
  end if;
  return jsonb_build_object('submission_id', sub_id, 'released', false);
end $$;

-- Teacher releases every fully marked result for an exercise (used with "manual" feedback).
create or replace function release_exercise_results(p_exercise uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int; lid uuid;
begin
  select lesson_id into lid from exercises where id = p_exercise;
  if lid is null or not can_manage_lesson(lid) then raise exception 'You are not allowed to do that.' using errcode = '42501'; end if;
  update exercise_results set released = true
   where released = false and submission_id in (select id from exercise_submissions where exercise_id = p_exercise and status = 'marked');
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function release_exercise_results(uuid) to authenticated;
revoke execute on function release_exercise_results(uuid) from anon, public;

-- Teacher lets a student try again by removing their submission.
create or replace function reset_submission(p_submission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  select e.lesson_id into lid from exercise_submissions s join exercises e on e.id = s.exercise_id where s.id = p_submission;
  if lid is null or not can_manage_lesson(lid) then raise exception 'You are not allowed to do that.' using errcode = '42501'; end if;
  delete from exercise_submissions where id = p_submission;
end $$;
grant execute on function reset_submission(uuid) to authenticated;
revoke execute on function reset_submission(uuid) from anon, public;
