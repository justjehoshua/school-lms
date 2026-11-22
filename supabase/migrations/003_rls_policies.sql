-- 003: Row Level Security. Default is deny: a table with RLS on and no matching policy returns nothing.

do $$
declare t text;
begin
  foreach t in array array['schools','profiles','academic_sessions','terms','classes','subjects','class_subjects',
    'teacher_assignments','enrollments','schemes_of_work','scheme_topics','lessons','lesson_slides',
    'student_progress','exercises','exercise_questions','exercise_question_keys','exercise_submissions','exercise_results'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- schools ------------------------------------------------------------------
create policy schools_read on schools for select to authenticated using (id = current_school_id());
create policy schools_admin_update on schools for update to authenticated
  using (is_admin() and id = current_school_id()) with check (id = current_school_id());

-- profiles -----------------------------------------------------------------
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or (is_admin() and school_id = current_school_id())
  or teacher_has_student(id)
);
-- Self-update is allowed; the protect_profile_columns trigger limits it to harmless fields.
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on profiles for update to authenticated
  using (is_admin() and school_id = current_school_id()) with check (school_id = current_school_id());
-- No INSERT/DELETE policies: accounts are provisioned by a server function using the service role.

-- Reference data readable by everyone in the school; written only by admins -----------------
do $$
declare t text;
begin
  foreach t in array array['academic_sessions','terms','classes','subjects','class_subjects'] loop
    execute format('create policy %1$s_read on %1$I for select to authenticated using (school_id = current_school_id())', t);
    execute format('create policy %1$s_admin_write on %1$I for all to authenticated
      using (is_admin() and school_id = current_school_id())
      with check (is_admin() and school_id = current_school_id())', t);
  end loop;
end $$;

-- teacher_assignments -------------------------------------------------------
create policy ta_read on teacher_assignments for select to authenticated using (
  school_id = current_school_id() and (is_admin() or teacher_id = auth.uid())
);
create policy ta_admin_write on teacher_assignments for all to authenticated
  using (is_admin() and school_id = current_school_id())
  with check (is_admin() and school_id = current_school_id());

-- enrollments ---------------------------------------------------------------
create policy enr_read on enrollments for select to authenticated using (
  school_id = current_school_id() and (
    is_admin() or student_id = auth.uid()
    or (is_teacher() and exists (select 1 from teacher_assignments t
        where t.teacher_id = auth.uid() and t.class_id = enrollments.class_id)))
);
create policy enr_admin_write on enrollments for all to authenticated
  using (is_admin() and school_id = current_school_id())
  with check (is_admin() and school_id = current_school_id());

-- schemes_of_work -----------------------------------------------------------
create policy sow_read on schemes_of_work for select to authenticated using (
  school_id = current_school_id() and (
    is_admin()
    or (is_teacher() and teacher_teaches(class_id, subject_id))
    or (is_student() and student_in_class(class_id)))
);
create policy sow_teacher_write on schemes_of_work for all to authenticated
  using (school_id = current_school_id() and is_teacher() and teacher_teaches(class_id, subject_id))
  with check (school_id = current_school_id() and is_teacher() and teacher_teaches(class_id, subject_id)
              and created_by = auth.uid());

-- scheme_topics: titles, dates and objectives only. No lesson content lives here, so students may read them.
create policy topics_read on scheme_topics for select to authenticated using (
  school_id = current_school_id() and exists (
    select 1 from schemes_of_work s where s.id = scheme_id
      and (is_admin()
           or (is_teacher() and teacher_teaches(s.class_id, s.subject_id))
           or (is_student() and student_in_class(s.class_id))))
);
create policy topics_teacher_write on scheme_topics for all to authenticated
  using (school_id = current_school_id() and teacher_manages_scheme(scheme_id))
  with check (school_id = current_school_id() and teacher_manages_scheme(scheme_id));

-- lessons -------------------------------------------------------------------
create policy lessons_read on lessons for select to authenticated using (can_read_lesson(id));
create policy lessons_teacher_insert on lessons for insert to authenticated
  with check (school_id = current_school_id() and is_teacher() and teacher_teaches(class_id, subject_id));
create policy lessons_teacher_update on lessons for update to authenticated
  using (can_manage_lesson(id))
  with check (school_id = current_school_id() and teacher_teaches(class_id, subject_id));
create policy lessons_teacher_delete on lessons for delete to authenticated using (can_manage_lesson(id));

-- lesson_slides: readable only when the parent lesson is readable ------------------------
create policy slides_read on lesson_slides for select to authenticated using (can_read_lesson(lesson_id));
create policy slides_teacher_write on lesson_slides for all to authenticated
  using (can_manage_lesson(lesson_id))
  with check (school_id = current_school_id() and can_manage_lesson(lesson_id));

-- student_progress ----------------------------------------------------------
create policy progress_student_read on student_progress for select to authenticated using (student_id = auth.uid());
create policy progress_staff_read on student_progress for select to authenticated using (
  school_id = current_school_id() and (is_admin() or can_manage_lesson(lesson_id))
);
create policy progress_student_insert on student_progress for insert to authenticated
  with check (student_id = auth.uid() and school_id = current_school_id() and is_student() and can_read_lesson(lesson_id));
create policy progress_student_update on student_progress for update to authenticated
  using (student_id = auth.uid() and can_read_lesson(lesson_id))
  with check (student_id = auth.uid() and can_read_lesson(lesson_id));

-- exercises -----------------------------------------------------------------
create policy ex_read on exercises for select to authenticated using (
  can_read_lesson(lesson_id) and (is_published or can_manage_lesson(lesson_id) or is_admin())
);
create policy ex_teacher_write on exercises for all to authenticated
  using (can_manage_lesson(lesson_id))
  with check (school_id = current_school_id() and can_manage_lesson(lesson_id));

create policy exq_read on exercise_questions for select to authenticated using (
  exists (select 1 from exercises e where e.id = exercise_id
          and can_read_lesson(e.lesson_id) and (e.is_published or can_manage_lesson(e.lesson_id) or is_admin()))
);
create policy exq_teacher_write on exercise_questions for all to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and can_manage_lesson(e.lesson_id)))
  with check (school_id = current_school_id()
              and exists (select 1 from exercises e where e.id = exercise_id and can_manage_lesson(e.lesson_id)));

-- Answer keys: teachers only. Students have no policy, therefore no access.
create policy exk_teacher on exercise_question_keys for all to authenticated
  using (exists (select 1 from exercise_questions q join exercises e on e.id = q.exercise_id
                 where q.id = question_id and can_manage_lesson(e.lesson_id)))
  with check (school_id = current_school_id()
              and exists (select 1 from exercise_questions q join exercises e on e.id = q.exercise_id
                          where q.id = question_id and can_manage_lesson(e.lesson_id)));

-- Submissions are created only through submit_exercise() (no student INSERT policy).
create policy sub_student_read on exercise_submissions for select to authenticated using (student_id = auth.uid());
create policy sub_staff_read on exercise_submissions for select to authenticated using (
  school_id = current_school_id() and (is_admin()
    or exists (select 1 from exercises e where e.id = exercise_id and can_manage_lesson(e.lesson_id)))
);

create policy res_student_read on exercise_results for select to authenticated using (
  released and exists (select 1 from exercise_submissions s where s.id = submission_id and s.student_id = auth.uid())
);
create policy res_staff_read on exercise_results for select to authenticated using (
  school_id = current_school_id() and (is_admin()
    or exists (select 1 from exercise_submissions s join exercises e on e.id = s.exercise_id
               where s.id = submission_id and can_manage_lesson(e.lesson_id)))
);
create policy res_teacher_update on exercise_results for update to authenticated
  using (exists (select 1 from exercise_submissions s join exercises e on e.id = s.exercise_id
                 where s.id = submission_id and can_manage_lesson(e.lesson_id)))
  with check (exists (select 1 from exercise_submissions s join exercises e on e.id = s.exercise_id
                 where s.id = submission_id and can_manage_lesson(e.lesson_id)));
-- Teacher marking a short answer also needs the submission status updated:
create policy sub_teacher_update on exercise_submissions for update to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and can_manage_lesson(e.lesson_id)))
  with check (exists (select 1 from exercises e where e.id = exercise_id and can_manage_lesson(e.lesson_id)));

-- Table privileges: RLS filters rows, GRANTs bound the verbs. Anonymous users get nothing.
revoke all on all tables in schema public from anon;
