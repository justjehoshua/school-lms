import { supabase } from '@/lib/supabase';
import { listClasses, listSessions, listSubjects, listTerms, type Period, type Subject, type Term } from '@/services/adminService';
import type { ProgressRow } from '@/services/progressService';
import type { TopicStatus } from '@/services/teacherService';

export interface StudentLesson { id: string; subject_id: string; term_id: string; week_number: number | null; topic: string | null; title: string; teacher_id: string; updated_at: string }
export interface StudentTopic { id: string; title: string; description: string | null; objectives: string | null; week_number: number; expected_date: string | null; status: TopicStatus; lesson_id: string | null; subject_id: string; term_id: string }
export interface StudentData {
  classId: string | null; className: string; session: Period | null; term: Term | null; terms: Term[];
  subjects: Subject[]; lessons: StudentLesson[]; topics: StudentTopic[]; progress: Map<string, ProgressRow>; teachers: Map<string, string>;
}
export type LearnStatus = 'completed' | 'in_progress' | 'available';

const check = (res: { error: unknown }) => { if (res.error) throw res.error; };

/** The database only returns what this student may see: their class, released lessons, their own progress. */
export async function loadStudentData(): Promise<StudentData> {
  const [sessions, terms, subjects, classes] = await Promise.all([listSessions(), listTerms(), listSubjects(), listClasses()]);
  const session = sessions.find((s) => s.is_current) ?? null;
  const term = terms.find((t) => t.is_current) ?? null;
  const base: StudentData = { classId: null, className: '', session, term, terms, subjects: [], lessons: [], topics: [], progress: new Map(), teachers: new Map() };

  const enr = await supabase.from('enrollments').select('class_id, session_id');
  check(enr);
  const rows = (enr.data ?? []) as { class_id: string; session_id: string }[];
  const mine = rows.find((r) => r.session_id === session?.id) ?? rows[0];
  if (!mine) return base;

  const [links, lessonsRes, topicsRes, progRes, staffRes] = await Promise.all([
    supabase.from('class_subjects').select('subject_id').eq('class_id', mine.class_id),
    supabase.from('lessons').select('id, subject_id, term_id, week_number, topic, title, teacher_id, updated_at').eq('class_id', mine.class_id).order('updated_at', { ascending: false }),
    supabase.from('scheme_topics').select('id, title, description, objectives, week_number, expected_date, status, lesson_id, schemes_of_work(subject_id, term_id)').order('week_number'),
    supabase.from('student_progress').select('lesson_id, last_slide_position, completed, completed_at, last_opened_at'),
    supabase.from('staff_directory').select('id, full_name'),
  ]);
  [links, lessonsRes, topicsRes, progRes, staffRes].forEach(check);

  const subjectIds = new Set(((links.data ?? []) as { subject_id: string }[]).map((l) => l.subject_id));
  type TopicRow = Omit<StudentTopic, 'subject_id' | 'term_id'> & { schemes_of_work: { subject_id: string; term_id: string } | { subject_id: string; term_id: string }[] | null };
  const topics = ((topicsRes.data ?? []) as TopicRow[]).flatMap((t) => {
    const s = Array.isArray(t.schemes_of_work) ? t.schemes_of_work[0] : t.schemes_of_work;
    if (!s) return [];
    const { schemes_of_work: _ignored, ...rest } = t;
    void _ignored;
    return [{ ...rest, subject_id: s.subject_id, term_id: s.term_id }];
  });

  return {
    ...base, classId: mine.class_id, className: classes.find((c) => c.id === mine.class_id)?.name ?? '',
    subjects: subjects.filter((s) => subjectIds.has(s.id)),
    lessons: (lessonsRes.data ?? []) as StudentLesson[], topics,
    progress: new Map(((progRes.data ?? []) as ProgressRow[]).map((p) => [p.lesson_id, p])),
    teachers: new Map(((staffRes.data ?? []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name])),
  };
}

export const learnStatus = (p?: ProgressRow): LearnStatus => (p?.completed ? 'completed' : p ? 'in_progress' : 'available');
export const availableLessonIds = (d: StudentData) => new Set(d.lessons.map((l) => l.id));
/** A topic is "upcoming" until a lesson for it has been released to the student. */
export const isUpcoming = (t: StudentTopic, ids: Set<string>) => t.status !== 'completed' && !(t.lesson_id && ids.has(t.lesson_id));
export function currentTopic(subjectId: string, d: StudentData): StudentTopic | null {
  const mine = d.topics.filter((t) => t.subject_id === subjectId && (!d.term || t.term_id === d.term.id));
  return mine.find((t) => t.status === 'in_progress') ?? mine.find((t) => t.status === 'planned') ?? null;
}
