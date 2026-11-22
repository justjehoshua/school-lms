import { supabase } from '@/lib/supabase';

export interface ProgressRow { lesson_id: string; last_slide_position: number; completed: boolean; completed_at: string | null; last_opened_at: string }

const check = (res: { error: unknown }) => { if (res.error) throw res.error; };
const key = { onConflict: 'student_id,lesson_id' };

export async function getMyProgress(lessonId: string): Promise<ProgressRow | null> {
  const res = await supabase.from('student_progress').select('lesson_id, last_slide_position, completed, completed_at, last_opened_at').eq('lesson_id', lessonId).maybeSingle();
  check(res);
  return (res.data as ProgressRow | null) ?? null;
}

// Each call upserts only the columns it names, so opening a lesson never resets a saved position.
export async function touchLesson(schoolId: string, studentId: string, lessonId: string) {
  check(await supabase.from('student_progress').upsert({ school_id: schoolId, student_id: studentId, lesson_id: lessonId, last_opened_at: new Date().toISOString() }, key));
}
export async function saveSlidePosition(schoolId: string, studentId: string, lessonId: string, position: number) {
  check(await supabase.from('student_progress').upsert({ school_id: schoolId, student_id: studentId, lesson_id: lessonId, last_slide_position: position, last_opened_at: new Date().toISOString() }, key));
}
export async function markLessonComplete(schoolId: string, studentId: string, lessonId: string) {
  check(await supabase.from('student_progress').upsert({ school_id: schoolId, student_id: studentId, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() }, key));
}

export async function getTeacherName(teacherId: string): Promise<string> {
  const res = await supabase.from('staff_directory').select('full_name').eq('id', teacherId).maybeSingle();
  check(res);
  return (res.data as { full_name: string } | null)?.full_name ?? 'Your teacher';
}
