import { supabase } from '@/lib/supabase';

export interface Subject { id: string; name: string; description: string | null; icon: string | null }
export interface ClassRow { id: string; name: string }
export interface ClassSubject { class_id: string; subject_id: string }
export interface Period { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
export interface Term extends Period { session_id: string }

interface PgResult { error: unknown }
const check = (res: PgResult) => { if (res.error) throw res.error; };

// ---- subjects ----
export async function listSubjects(): Promise<Subject[]> {
  const res = await supabase.from('subjects').select('id, name, description, icon').order('name');
  check(res);
  return (res.data ?? []) as Subject[];
}
export async function saveSubject(schoolId: string, id: string | null, v: { name: string; description: string; icon: string }) {
  const row = { name: v.name.trim(), description: v.description.trim() || null, icon: v.icon || null };
  check(id ? await supabase.from('subjects').update(row).eq('id', id)
           : await supabase.from('subjects').insert({ ...row, school_id: schoolId }));
}
export async function deleteSubject(id: string) { check(await supabase.from('subjects').delete().eq('id', id)); }

// ---- classes and their subjects ----
export async function listClasses(): Promise<ClassRow[]> {
  const res = await supabase.from('classes').select('id, name').order('name');
  check(res);
  return (res.data ?? []) as ClassRow[];
}
export async function listClassSubjects(): Promise<ClassSubject[]> {
  const res = await supabase.from('class_subjects').select('class_id, subject_id');
  check(res);
  return (res.data ?? []) as ClassSubject[];
}
export async function saveClass(schoolId: string, id: string | null, name: string, subjectIds: string[]) {
  let classId = id;
  if (id) {
    check(await supabase.from('classes').update({ name: name.trim() }).eq('id', id));
  } else {
    const res = await supabase.from('classes').insert({ name: name.trim(), school_id: schoolId }).select('id').single();
    check(res);
    classId = (res.data as { id: string }).id;
  }
  if (!classId) return;
  const existing = await supabase.from('class_subjects').select('subject_id').eq('class_id', classId);
  check(existing);
  const have = new Set(((existing.data ?? []) as { subject_id: string }[]).map((r) => r.subject_id));
  const want = new Set(subjectIds);
  const toAdd = subjectIds.filter((s) => !have.has(s));
  const toRemove = [...have].filter((s) => !want.has(s));
  if (toAdd.length) check(await supabase.from('class_subjects').insert(toAdd.map((s) => ({ class_id: classId, subject_id: s, school_id: schoolId }))));
  if (toRemove.length) check(await supabase.from('class_subjects').delete().eq('class_id', classId).in('subject_id', toRemove));
}
export async function deleteClass(id: string) { check(await supabase.from('classes').delete().eq('id', id)); }

// ---- sessions and terms ----
export async function listSessions(): Promise<Period[]> {
  const res = await supabase.from('academic_sessions').select('id, name, start_date, end_date, is_current').order('start_date', { ascending: false });
  check(res);
  return (res.data ?? []) as Period[];
}
export async function listTerms(): Promise<Term[]> {
  const res = await supabase.from('terms').select('id, session_id, name, start_date, end_date, is_current').order('start_date');
  check(res);
  return (res.data ?? []) as Term[];
}
type PeriodValues = { name: string; start_date: string; end_date: string };
export async function saveSession(schoolId: string, id: string | null, v: PeriodValues) {
  check(id ? await supabase.from('academic_sessions').update(v).eq('id', id)
           : await supabase.from('academic_sessions').insert({ ...v, school_id: schoolId }));
}
export async function saveTerm(schoolId: string, sessionId: string, id: string | null, v: PeriodValues) {
  check(id ? await supabase.from('terms').update(v).eq('id', id)
           : await supabase.from('terms').insert({ ...v, school_id: schoolId, session_id: sessionId }));
}
export async function deleteSession(id: string) { check(await supabase.from('academic_sessions').delete().eq('id', id)); }
export async function deleteTerm(id: string) { check(await supabase.from('terms').delete().eq('id', id)); }

// Only one current session / term per school (enforced by a unique index), so clear the old one first.
export async function setCurrentSession(id: string) {
  check(await supabase.from('academic_sessions').update({ is_current: false }).eq('is_current', true));
  check(await supabase.from('academic_sessions').update({ is_current: true }).eq('id', id));
}
export async function setCurrentTerm(id: string) {
  check(await supabase.from('terms').update({ is_current: false }).eq('is_current', true));
  check(await supabase.from('terms').update({ is_current: true }).eq('id', id));
}

// ---- dashboard counts ----
export interface AdminCounts { teachers: number; students: number; classes: number; subjects: number }
export async function loadAdminCounts(): Promise<AdminCounts> {
  const count = async (table: string, role?: string) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (role) q = q.eq('role', role);
    const res = await q;
    check(res);
    return (res as unknown as { count: number | null }).count ?? 0;
  };
  const [teachers, students, classes, subjects] = await Promise.all([
    count('profiles', 'teacher'), count('profiles', 'student'), count('classes'), count('subjects'),
  ]);
  return { teachers, students, classes, subjects };
}
