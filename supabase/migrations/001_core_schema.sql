-- 001: core schema. Every tenant-owned table carries school_id so multi-school is a policy change, not a redesign.
create extension if not exists pgcrypto;

create type user_role      as enum ('admin', 'teacher', 'student');
create type lesson_status  as enum ('draft', 'scheduled', 'published', 'archived');
create type topic_status   as enum ('planned', 'in_progress', 'completed');
create type slide_type     as enum ('title', 'text', 'objectives', 'image_text', 'example', 'exercise', 'summary');
create type question_type  as enum ('multiple_choice', 'true_false', 'short_answer');
create type submission_status as enum ('marked', 'needs_review');
create type feedback_mode  as enum ('immediate', 'manual');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per auth user. Rows are created by an admin-only server function (service role), never by the browser.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete restrict,
  role user_role not null,
  full_name text not null check (char_length(full_name) between 2 and 150),
  email text,
  registration_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_has_regno check (role <> 'student' or registration_number is not null),
  unique (school_id, registration_number)
);
create index profiles_school_role_idx on profiles (school_id, role);

create table academic_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                       -- e.g. 2026/2027
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (school_id, name)
);
create unique index one_current_session on academic_sessions (school_id) where is_current;

create table terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  session_id uuid not null references academic_sessions(id) on delete cascade,
  name text not null,                       -- First Term
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (session_id, name)
);
create unique index one_current_term on terms (school_id) where is_current;

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,                       -- Basic 5
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  icon text,                                -- lucide icon name, optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table class_subjects (
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  primary key (class_id, subject_id)
);
create index class_subjects_subject_idx on class_subjects (subject_id);

create table teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (class_id, subject_id) references class_subjects (class_id, subject_id) on delete cascade,
  unique (teacher_id, class_id, subject_id)
);
create index teacher_assignments_class_subject_idx on teacher_assignments (class_id, subject_id);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  session_id uuid not null references academic_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);
create index enrollments_class_idx on enrollments (class_id);

create table schemes_of_work (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  session_id uuid not null references academic_sessions(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, subject_id) references class_subjects (class_id, subject_id) on delete cascade,
  unique (class_id, subject_id, term_id)
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  session_id uuid not null references academic_sessions(id),
  term_id uuid not null references terms(id),
  week_number int check (week_number between 1 and 30),
  topic text,
  title text not null check (char_length(title) between 2 and 200),
  objectives text,
  introduction text,
  summary text,
  teacher_id uuid not null references profiles(id),
  status lesson_status not null default 'draft',
  publish_at timestamptz,
  available_until timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, subject_id) references class_subjects (class_id, subject_id),
  check (status <> 'scheduled' or publish_at is not null),
  check (available_until is null or publish_at is null or available_until > publish_at)
);
create index lessons_class_subject_idx on lessons (class_id, subject_id, status);
create index lessons_teacher_idx on lessons (teacher_id);
create index lessons_publish_idx on lessons (status, publish_at);

create table scheme_topics (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references schemes_of_work(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  week_number int not null check (week_number between 1 and 30),
  title text not null check (char_length(title) between 2 and 200),
  description text,
  objectives text,
  expected_date date,
  status topic_status not null default 'planned',
  position int not null default 0,
  lesson_id uuid references lessons(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheme_topics_scheme_idx on scheme_topics (scheme_id, position);

create table lesson_slides (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  position int not null check (position >= 0),
  slide_type slide_type not null default 'text',
  title text check (char_length(title) <= 200),
  body_html text check (char_length(body_html) <= 20000),  -- sanitized again on render (DOMPurify, Stage 6)
  image_path text,                                          -- path inside the lesson-images bucket
  layout text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, position) deferrable initially deferred
);

create table student_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  last_slide_position int not null default 0 check (last_slide_position >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index student_progress_lesson_idx on student_progress (lesson_id);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  feedback feedback_mode not null default 'immediate',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_lesson_idx on exercises (lesson_id);

-- Questions are student-readable, so they never hold answers.
create table exercise_questions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  position int not null default 0,
  qtype question_type not null,
  prompt text not null check (char_length(prompt) between 1 and 2000),
  options jsonb,                            -- for multiple_choice: ["Option A", "Option B", ...]
  points numeric not null default 1 check (points > 0),
  created_at timestamptz not null default now(),
  check (qtype <> 'multiple_choice' or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8))
);
create index exercise_questions_ex_idx on exercise_questions (exercise_id, position);

-- Answer keys live apart so no student policy can ever expose them.
create table exercise_question_keys (
  question_id uuid primary key references exercise_questions(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  correct_answer jsonb,                     -- "Option A" | "true" | accepted short answers ["x","y"]
  explanation text
);

create table exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null,                   -- { "<question_id>": "answer" }
  status submission_status not null,
  submitted_at timestamptz not null default now(),
  unique (exercise_id, student_id)
);

-- Marks are separate: students only see a row once released = true.
create table exercise_results (
  submission_id uuid primary key references exercise_submissions(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  score numeric not null default 0,
  max_score numeric not null default 0,
  per_question jsonb not null default '{}'::jsonb,  -- { "<qid>": {"correct": true, "points": 1, "explanation": "..."} }
  released boolean not null default false,
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['schools','profiles','academic_sessions','terms','classes','subjects','schemes_of_work',
    'lessons','scheme_topics','lesson_slides','student_progress','exercises','exercise_results'] loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
