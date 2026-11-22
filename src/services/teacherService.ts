import { supabase } from '@/lib/supabase';

export type TopicStatus = 'planned' | 'in_progress' | 'completed';
export interface Topic {
  id: string; scheme_id: string; week_number: number; title: string;
  description: string | null; objectives: string | null; expected_date: string | null;
  status: TopicStatus; position: number; lesson_id: string | null;
}
export interface TopicValues { week_number: number; title: string; description: string; objectives: string; expected_date: string }
export interface LessonSummary { id: string; title: string; status: string; class_id: string; subject_id: string; updated_at: string }
export interface UpcomingTopic { id: string; title: string; week_number: number; expected_date: string | null; status: TopicStatus; class_id: string; subject_id: string }

const check = (res: { error: unknown }) => { if (res.error) throw res.error; };
const TOPIC_COLS = 'id, scheme_id, week_number, title, description, objectives, expected_date, status, position, lesson_id';

// ---- schemes of work ----
export async function findScheme(classId: string, subjectId: string, termId: string): Promise<string | null> {
  const res = await supabase.from('schemes_of_work').select('id').eq('class_id', classId).eq('subject_id', subjectId).eq('term_id', termId).maybeSingle();
  check(res);
  return (res.data as { id: string } | null)?.id ?? null;
}

/** Schemes are created lazily, the first time a topic is added. */
export async function ensureScheme(schoolId: string, teacherId: string, classId: string, subjectId: string, sessionId: string, termId: string): Promise<string> {
  const existing = await findScheme(classId, subjectId, termId);
  if (existing) return existing;
  const res = await supabase.from('schemes_of_work')
    .insert({ school_id: schoolId, class_id: classId, subject_id: subjectId, session_id: sessionId, term_id: termId, created_by: teacherId })
    .select('id').single();
  if (res.error) {
    const again = await findScheme(classId, subjectId, termId); // another teacher may have just created it
    if (again) return again;
    throw res.error;
  }
  return (res.data as { id: string }).id;
}

export async function listTopics(schemeId: string): Promise<Topic[]> {
  const res = await supabase.from('scheme_topics').select(TOPIC_COLS).eq('scheme_id', schemeId).order('position').order('week_number');
  check(res);
  return (res.data ?? []) as Topic[];
}

export async function saveTopic(schoolId: string, schemeId: string, id: string | null, v: TopicValues, nextPosition: number) {
  const row = {
    week_number: v.week_number, title: v.title.trim(),
    description: v.description.trim() || null, objectives: v.objectives.trim() || null,
    expected_date: v.expected_date || null,
  };
  check(id
    ? await supabase.from('scheme_topics').update(row).eq('id', id)
    : await supabase.from('scheme_topics').insert({ ...row, school_id: schoolId, scheme_id: schemeId, position: nextPosition }));
}

export async function deleteTopic(id: string) { check(await supabase.from('scheme_topics').delete().eq('id', id)); }
export async function setTopicStatus(id: string, status: TopicStatus) { check(await supabase.from('scheme_topics').update({ status }).eq('id', id)); }

export async function reorderTopics(orderedIds: string[]) {
  const results = await Promise.all(orderedIds.map((id, i) => supabase.from('scheme_topics').update({ position: i }).eq('id', id)));
  results.forEach(check);
}

// ---- dashboard data ----
export async function loadTeacherCounts() {
  const count = async (status?: string) => {
    let q = supabase.from('lessons').select('id', { count: 'exact', head: true });
    if (status) q = q.eq('status', status);
    const res = await q;
    check(res);
    return (res as unknown as { count: number | null }).count ?? 0;
  };
  const [total, published, drafts] = await Promise.all([count(), count('published'), count('draft')]);
  return { total, published, drafts };
}

export async function listRecentLessons(limit = 5): Promise<LessonSummary[]> {
  const res = await supabase.from('lessons').select('id, title, status, class_id, subject_id, updated_at').order('updated_at', { ascending: false }).limit(limit);
  check(res);
  return (res.data ?? []) as LessonSummary[];
}

export async function listUpcomingTopics(limit = 50): Promise<UpcomingTopic[]> {
  const res = await supabase.from('scheme_topics')
    .select('id, title, week_number, expected_date, status, schemes_of_work(class_id, subject_id)')
    .neq('status', 'completed')
    .order('expected_date', { ascending: true, nullsFirst: false })
    .limit(limit);
  check(res);
  type Row = { id: string; title: string; week_number: number; expected_date: string | null; status: TopicStatus;
    schemes_of_work: { class_id: string; subject_id: string } | { class_id: string; subject_id: string }[] | null };
  return ((res.data ?? []) as Row[]).flatMap((r) => {
    const s = Array.isArray(r.schemes_of_work) ? r.schemes_of_work[0] : r.schemes_of_work;
    return s ? [{ id: r.id, title: r.title, week_number: r.week_number, expected_date: r.expected_date, status: r.status, class_id: s.class_id, subject_id: s.subject_id }] : [];
  });
}

/** Students per class for one session, tallied client-side (teachers only see classes they teach). */
export async function countStudentsByClass(sessionId: string): Promise<Record<string, number>> {
  const res = await supabase.from('enrollments').select('class_id').eq('session_id', sessionId);
  check(res);
  const tally: Record<string, number> = {};
  ((res.data ?? []) as { class_id: string }[]).forEach((r) => { tally[r.class_id] = (tally[r.class_id] ?? 0) + 1; });
  return tally;
}
