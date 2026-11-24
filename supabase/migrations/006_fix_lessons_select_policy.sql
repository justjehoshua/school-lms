-- 006: fix "permission denied" when a teacher creates a lesson.
-- Creating a row also reads it back (INSERT ... RETURNING). The old SELECT policy looked the lesson up by id
-- inside a helper function, and that lookup cannot see a row inserted by the very same statement.
-- The new policy checks the row's own columns instead, so it works at insert time.

drop policy if exists lessons_read on lessons;

create policy lessons_read on lessons for select to authenticated using (
  school_id = current_school_id() and (
    is_admin()
    or (is_teacher() and teacher_teaches(class_id, subject_id))
    or (is_student() and student_in_class(class_id) and lesson_released(status, publish_at, available_until))
  )
);
