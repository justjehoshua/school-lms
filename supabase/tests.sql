-- Manual security checks. Run in the SQL editor AFTER you have created sample users.
-- Replace the UUIDs, then run each block. Expected results are in the comments.

-- Pretend to be a student (use a real student's auth UUID):
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<STUDENT_UUID>","role":"authenticated"}';
  select count(*) from lessons where status = 'draft';                 -- expect 0
  select count(*) from lesson_slides;                                   -- only slides of released lessons
  select count(*) from exercise_question_keys;                          -- expect 0
  update profiles set role = 'admin' where id = '<STUDENT_UUID>';       -- expect ERROR: cannot change these account fields
  insert into lessons (school_id, class_id, subject_id, session_id, term_id, title, teacher_id)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'x', '<STUDENT_UUID>'); -- expect ERROR (RLS)
rollback;

-- Pretend to be a teacher who does NOT teach class C / subject S:
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<TEACHER_UUID>","role":"authenticated"}';
  select count(*) from lessons where class_id = '<OTHER_CLASS_UUID>';   -- expect 0
  update lessons set title = 'hacked' where class_id = '<OTHER_CLASS_UUID>'; -- expect UPDATE 0
rollback;

-- Scheduled lesson: set publish_at one minute ahead, confirm the student sees 0 rows, wait, confirm 1 row.
