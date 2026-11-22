-- 002: SECURITY DEFINER helpers used by RLS. They read tables directly (bypassing RLS) to avoid recursion.
-- Deactivated users resolve to no role / no school, so they lose all access immediately.

create or replace function current_school_id() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from profiles where id = auth.uid() and is_active
$$;

create or replace function app_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false)
$$;

create or replace function is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'teacher', false)
$$;

create or replace function is_student() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'student', false)
$$;

create or replace function teacher_teaches(p_class uuid, p_subject uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from teacher_assignments
    where teacher_id = auth.uid() and class_id = p_class and subject_id = p_subject)
$$;

create or replace function student_in_class(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where student_id = auth.uid() and class_id = p_class)
$$;

-- Server-side release rule. Evaluated at query time, so scheduled lessons open at publish_at
-- with no browser involvement and no cron dependency.
create or replace function lesson_released(p_status lesson_status, p_publish_at timestamptz, p_until timestamptz)
returns boolean language sql stable as $$
  select p_status in ('published', 'scheduled')
     and (p_publish_at is null or p_publish_at <= now())
     and (p_until is null or p_until > now())
     and not (p_status = 'scheduled' and p_publish_at is null)
$$;

create or replace function can_manage_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lessons l
    where l.id = p_lesson and l.school_id = current_school_id()
      and is_teacher() and teacher_teaches(l.class_id, l.subject_id))
$$;

create or replace function can_read_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from lessons l
    where l.id = p_lesson and l.school_id = current_school_id()
      and (
        is_admin()
        or (is_teacher() and teacher_teaches(l.class_id, l.subject_id))
        or (is_student() and student_in_class(l.class_id)
            and lesson_released(l.status, l.publish_at, l.available_until))
      ))
$$;

create or replace function teacher_manages_scheme(p_scheme uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from schemes_of_work s
    where s.id = p_scheme and s.school_id = current_school_id()
      and is_teacher() and teacher_teaches(s.class_id, s.subject_id))
$$;

create or replace function teacher_has_student(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_teacher() and exists (
    select 1 from enrollments e
    join teacher_assignments t on t.class_id = e.class_id and t.teacher_id = auth.uid()
    where e.student_id = p_student)
$$;

-- Users may change only their own display name. Role, school, status and registration number
-- are locked unless the caller is an admin or the server (service role has auth.uid() = null).
create or replace function protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.role is distinct from old.role
     or new.school_id is distinct from old.school_id
     or new.is_active is distinct from old.is_active
     or new.registration_number is distinct from old.registration_number
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'You cannot change these account fields.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles
  for each row execute function protect_profile_columns();

-- Stamp published_at and keep ownership honest.
create or replace function lessons_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null and is_teacher() then
    new.teacher_id := auth.uid();
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  if new.status in ('draft','scheduled') then new.published_at := null; end if;
  return new;
end $$;
create trigger lessons_guard_trg before insert or update on lessons
  for each row execute function lessons_guard();

-- Public staff directory: names only, so students can see a teacher's name without reading profiles.
create view staff_directory with (security_barrier = true) as
  select id, school_id, full_name from profiles
  where role in ('teacher','admin') and is_active and school_id = current_school_id();
grant select on staff_directory to authenticated;

-- Optional housekeeping: flips due scheduled lessons to 'published'. Access never depends on it.
create or replace function promote_scheduled_lessons() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update lessons set status = 'published'
   where status = 'scheduled' and publish_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function promote_scheduled_lessons() from public, anon, authenticated;
-- To run it every minute (Database > Extensions > enable pg_cron):
-- select cron.schedule('promote-lessons', '* * * * *', 'select promote_scheduled_lessons()');
