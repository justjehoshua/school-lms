import { supabase } from '@/lib/supabase';

/** Titles and subjects of the lessons this student may open (the database filters out everything else). */
export async function listLessonTitles(): Promise<Map<string, { title: string; subject_id: string }>> {
  const res = await supabase.from('lessons').select('id, title, subject_id');
  if (res.error) throw res.error;
  return new Map(((res.data ?? []) as { id: string; title: string; subject_id: string }[]).map((l) => [l.id, { title: l.title, subject_id: l.subject_id }]));
}
