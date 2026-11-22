import { supabase } from '@/lib/supabase';
import type { LessonStatus } from '@/utils/lessonStatus';

export interface Lesson {
  id: string; school_id: string; class_id: string; subject_id: string; session_id: string; term_id: string;
  week_number: number | null; topic: string | null; title: string; objectives: string | null;
  introduction: string | null; summary: string | null; teacher_id: string; status: LessonStatus;
  publish_at: string | null; available_until: string | null; published_at: string | null;
  created_at: string; updated_at: string;
}
export interface LessonFilters { search: string; status: '' | LessonStatus; classId: string; subjectId: string; page: number; pageSize: number }
export interface LessonInput {
  class_id: string; subject_id: string; session_id: string; term_id: string; week_number: number | null;
  topic: string; title: string; objectives: string; introduction: string; summary: string;
}

const COLS = 'id, school_id, class_id, subject_id, session_id, term_id, week_number, topic, title, objectives, introduction, summary, teacher_id, status, publish_at, available_until, published_at, created_at, updated_at';
const check = (res: { error: unknown }) => { if (res.error) throw res.error; };
const nullable = (s: string) => s.trim() || null;

export async function listLessons(f: LessonFilters): Promise<{ rows: Lesson[]; total: number }> {
  let q = supabase.from('lessons').select(COLS, { count: 'exact' });
  q = f.status ? q.eq('status', f.status) : q.neq('status', 'archived');
  if (f.classId) q = q.eq('class_id', f.classId);
  if (f.subjectId) q = q.eq('subject_id', f.subjectId);
  const term = f.search.trim().replace(/[\\%_]/g, '\\$&');
  if (term) q = q.ilike('title', `%${term}%`);
  const from = (f.page - 1) * f.pageSize;
  const res = await q.order('updated_at', { ascending: false }).range(from, from + f.pageSize - 1);
  check(res);
  return { rows: (res.data ?? []) as Lesson[], total: (res as unknown as { count: number | null }).count ?? 0 };
}

export async function getLesson(id: string): Promise<Lesson | null> {
  const res = await supabase.from('lessons').select(COLS).eq('id', id).maybeSingle();
  check(res);
  return (res.data as Lesson | null) ?? null;
}

export async function countSlides(lessonId: string): Promise<number> {
  const res = await supabase.from('lesson_slides').select('id', { count: 'exact', head: true }).eq('lesson_id', lessonId);
  check(res);
  return (res as unknown as { count: number | null }).count ?? 0;
}

export async function createLesson(schoolId: string, teacherId: string, v: LessonInput): Promise<string> {
  const res = await supabase.from('lessons').insert({
    school_id: schoolId, teacher_id: teacherId, class_id: v.class_id, subject_id: v.subject_id,
    session_id: v.session_id, term_id: v.term_id, week_number: v.week_number, topic: nullable(v.topic),
    title: v.title.trim(), objectives: nullable(v.objectives), introduction: nullable(v.introduction), summary: nullable(v.summary),
  }).select('id').single();
  check(res);
  return (res.data as { id: string }).id;
}

/** Class and subject are fixed once a lesson exists. */
export async function updateLesson(id: string, v: LessonInput) {
  check(await supabase.from('lessons').update({
    session_id: v.session_id, term_id: v.term_id, week_number: v.week_number, topic: nullable(v.topic),
    title: v.title.trim(), objectives: nullable(v.objectives), introduction: nullable(v.introduction), summary: nullable(v.summary),
  }).eq('id', id));
}

/** Links a lesson to one scheme topic (or none), clearing any earlier link for this lesson. */
export async function linkTopic(lessonId: string, topicId: string | null) {
  check(await supabase.from('scheme_topics').update({ lesson_id: null }).eq('lesson_id', lessonId));
  if (topicId) check(await supabase.from('scheme_topics').update({ lesson_id: lessonId }).eq('id', topicId));
}

export async function linkedTopicId(lessonId: string): Promise<string | null> {
  const res = await supabase.from('scheme_topics').select('id').eq('lesson_id', lessonId).limit(1);
  check(res);
  return ((res.data ?? []) as { id: string }[])[0]?.id ?? null;
}

// ---- publishing workflow ----
export async function releaseLesson(id: string, mode: 'publish' | 'schedule', publishAt: string | null, until: string | null) {
  const patch = mode === 'publish'
    ? { status: 'published', publish_at: null, available_until: until }
    : { status: 'scheduled', publish_at: publishAt, available_until: until };
  check(await supabase.from('lessons').update(patch).eq('id', id));
}
export async function unpublishLesson(id: string) {
  check(await supabase.from('lessons').update({ status: 'draft', publish_at: null, available_until: null }).eq('id', id));
}
export async function archiveLesson(id: string) {
  check(await supabase.from('lessons').update({ status: 'archived', publish_at: null, available_until: null }).eq('id', id));
}
export const restoreLesson = unpublishLesson;
export async function deleteLesson(id: string) { check(await supabase.from('lessons').delete().eq('id', id)); }

/** Copies the lesson, its slides and its images into a new draft. */
export async function duplicateLesson(source: Lesson, teacherId: string): Promise<string> {
  const ins = await supabase.from('lessons').insert({
    school_id: source.school_id, teacher_id: teacherId, class_id: source.class_id, subject_id: source.subject_id,
    session_id: source.session_id, term_id: source.term_id, week_number: source.week_number, topic: source.topic,
    title: `${source.title} (copy)`.slice(0, 200), objectives: source.objectives, introduction: source.introduction, summary: source.summary,
  }).select('id').single();
  check(ins);
  const newId = (ins.data as { id: string }).id;
  try {
    const sres = await supabase.from('lesson_slides').select('position, slide_type, title, body_html, image_path, layout').eq('lesson_id', source.id).order('position');
    check(sres);
    type Slide = { position: number; slide_type: string; title: string | null; body_html: string | null; image_path: string | null; layout: string };
    const rows = await Promise.all(((sres.data ?? []) as Slide[]).map(async (s) => {
      let image_path = s.image_path;
      if (image_path) {
        const dest = `${source.school_id}/${newId}/${image_path.split('/').pop()}`;
        const { error } = await supabase.storage.from('lesson-images').copy(image_path, dest);
        image_path = error ? null : dest;
      }
      return { ...s, image_path, lesson_id: newId, school_id: source.school_id };
    }));
    if (rows.length) check(await supabase.from('lesson_slides').insert(rows));
  } catch (e) {
    await supabase.from('lessons').delete().eq('id', newId); // never leave a half-copied lesson behind
    throw e;
  }
  return newId;
}
