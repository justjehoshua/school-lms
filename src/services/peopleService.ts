import { supabase } from '@/lib/supabase';
import { UserFacingError } from '@/lib/errors';
import { identifierToEmail } from '@/services/authService';

export interface Person { id: string; full_name: string; email: string | null; registration_number: string | null; is_active: boolean }
export interface Enrollment { student_id: string; class_id: string }
export interface Assignment { id: string; teacher_id: string; class_id: string; subject_id: string }

const check = (res: { error: unknown }) => { if (res.error) throw res.error; };

export async function listPeople(role: 'teacher' | 'student'): Promise<Person[]> {
  const res = await supabase.from('profiles').select('id, full_name, email, registration_number, is_active').eq('role', role).order('full_name');
  check(res);
  return (res.data ?? []) as Person[];
}

export async function listEnrollments(sessionId: string): Promise<Enrollment[]> {
  const res = await supabase.from('enrollments').select('student_id, class_id').eq('session_id', sessionId);
  check(res);
  return (res.data ?? []) as Enrollment[];
}

export async function assignStudentClass(schoolId: string, studentId: string, sessionId: string, classId: string) {
  check(await supabase.from('enrollments').upsert(
    { school_id: schoolId, student_id: studentId, session_id: sessionId, class_id: classId },
    { onConflict: 'student_id,session_id' },
  ));
}

// ---- account functions (run on the server via the admin-users Edge Function) ----
async function callAdminFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let message = 'Could not reach the server function. Check that "admin-users" is deployed.';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) message = ((await ctx.json()) as { error?: string }).error ?? message;
    } catch { /* keep default message */ }
    throw new UserFacingError(message);
  }
  if (data && typeof data === 'object' && 'error' in data) throw new UserFacingError(String((data as { error: unknown }).error));
  return data;
}

export async function createTeacher(v: { full_name: string; email: string; password: string }) {
  await callAdminFn({ action: 'create_user', role: 'teacher', ...v });
}

export async function createStudent(v: { full_name: string; registration_number: string; password: string; class_id: string; session_id: string }) {
  const regno = v.registration_number.trim().toLowerCase();
  await callAdminFn({ action: 'create_user', role: 'student', ...v, registration_number: regno, email: identifierToEmail(regno) });
}

export const resetPassword = (userId: string, password: string) => callAdminFn({ action: 'reset_password', user_id: userId, password });
export const setActive = (userId: string, isActive: boolean) => callAdminFn({ action: 'set_active', user_id: userId, is_active: isActive });

// ---- teacher assignments ----
export async function listAssignments(): Promise<Assignment[]> {
  const res = await supabase.from('teacher_assignments').select('id, teacher_id, class_id, subject_id');
  check(res);
  return (res.data ?? []) as Assignment[];
}
export async function addAssignment(schoolId: string, teacherId: string, classId: string, subjectId: string) {
  check(await supabase.from('teacher_assignments').insert({ school_id: schoolId, teacher_id: teacherId, class_id: classId, subject_id: subjectId }));
}
export async function removeAssignment(id: string) { check(await supabase.from('teacher_assignments').delete().eq('id', id)); }
