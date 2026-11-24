import { supabase } from '@/lib/supabase';
import { UserFacingError } from '@/lib/errors';

export type QType = 'multiple_choice' | 'true_false' | 'short_answer';
export interface QuestionDraft { id: string; qtype: QType; prompt: string; options: string[]; points: number; correct: string; explanation: string }
export interface ExerciseMeta { id: string; lesson_id: string; title: string; feedback: 'immediate' | 'manual'; is_published: boolean }
export interface PerQuestion { correct: boolean | null; points: number; explanation?: string | null; correct_answer?: unknown }
export interface SubmissionRow {
  id: string; student_id: string; student_name: string; status: 'marked' | 'needs_review'; submitted_at: string;
  answers: Record<string, string>; score: number | null; max_score: number | null; released: boolean; per_question: Record<string, PerQuestion>;
}

const check = (res: { error: unknown }) => { if (res.error) throw res.error; };
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) { if (error.code === 'P0001' || error.code === '42501') throw new UserFacingError(error.message); throw error; }
  return data as T;
}
const answerText = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : '');

export function newQuestion(qtype: QType = 'multiple_choice'): QuestionDraft {
  return { id: crypto.randomUUID(), qtype, prompt: '', options: qtype === 'multiple_choice' ? ['', ''] : [], points: 1, correct: '', explanation: '' };
}

export function validateQuestions(qs: QuestionDraft[]): string | null {
  for (const [i, q] of qs.entries()) {
    const n = i + 1;
    if (!q.prompt.trim()) return `Question ${n} has no text.`;
    if (!(q.points > 0)) return `Question ${n} needs points greater than zero.`;
    if (q.qtype === 'multiple_choice') {
      const opts = q.options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return `Question ${n} needs at least two options.`;
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return `Question ${n} has two identical options.`;
      if (!opts.includes(q.correct.trim())) return `Question ${n}: choose the correct option.`;
    }
    if (q.qtype === 'true_false' && q.correct !== 'true' && q.correct !== 'false') return `Question ${n}: choose True or False.`;
  }
  return null;
}

// ---- teacher ----
export async function getLessonExercise(lessonId: string): Promise<ExerciseMeta | null> {
  const res = await supabase.from('exercises').select('id, lesson_id, title, feedback, is_published').eq('lesson_id', lessonId).order('created_at').limit(1);
  check(res);
  return ((res.data ?? []) as ExerciseMeta[])[0] ?? null;
}

export async function getQuestionsForEdit(exerciseId: string): Promise<{ questions: QuestionDraft[]; hasSubmissions: boolean }> {
  const [qs, subs] = await Promise.all([
    supabase.from('exercise_questions').select('id, qtype, prompt, options, points').eq('exercise_id', exerciseId).order('position'),
    supabase.from('exercise_submissions').select('id', { count: 'exact', head: true }).eq('exercise_id', exerciseId),
  ]);
  check(qs); check(subs);
  type Q = { id: string; qtype: QType; prompt: string; options: string[] | null; points: number };
  const rows = (qs.data ?? []) as Q[];
  const keys = rows.length ? await supabase.from('exercise_question_keys').select('question_id, correct_answer, explanation').in('question_id', rows.map((r) => r.id)) : { data: [], error: null };
  check(keys);
  const byId = new Map(((keys.data ?? []) as { question_id: string; correct_answer: unknown; explanation: string | null }[]).map((k) => [k.question_id, k]));
  return {
    hasSubmissions: ((subs as unknown as { count: number | null }).count ?? 0) > 0,
    questions: rows.map((r) => ({ id: r.id, qtype: r.qtype, prompt: r.prompt, options: r.options ?? [], points: Number(r.points),
      correct: answerText(byId.get(r.id)?.correct_answer), explanation: byId.get(r.id)?.explanation ?? '' })),
  };
}

export async function saveExercise(lessonId: string, exerciseId: string | null, meta: { title: string; feedback: 'immediate' | 'manual'; is_published: boolean }, questions: QuestionDraft[] | null): Promise<string> {
  const payload = questions && questions.map((q) => ({
    qtype: q.qtype, prompt: q.prompt.trim(), points: q.points, explanation: q.explanation.trim(),
    options: q.qtype === 'multiple_choice' ? q.options.map((o) => o.trim()).filter(Boolean) : null,
    correct_answer: q.qtype === 'short_answer' ? (q.correct.trim() || null) : q.correct.trim(),
  }));
  return rpc<string>('save_exercise', { p_lesson: lessonId, p_exercise: exerciseId, p_title: meta.title, p_feedback: meta.feedback, p_published: meta.is_published, p_questions: payload });
}

export async function listSubmissions(exerciseId: string): Promise<SubmissionRow[]> {
  const res = await supabase.from('exercise_submissions').select('id, student_id, status, submitted_at, answers, exercise_results(score, max_score, released, per_question)').eq('exercise_id', exerciseId).order('submitted_at', { ascending: false });
  check(res);
  type R = { score: number; max_score: number; released: boolean; per_question: Record<string, PerQuestion> };
  type Row = { id: string; student_id: string; status: SubmissionRow['status']; submitted_at: string; answers: Record<string, string>; exercise_results: R | R[] | null };
  const rows = (res.data ?? []) as Row[];
  const names = rows.length ? await supabase.from('profiles').select('id, full_name').in('id', rows.map((r) => r.student_id)) : { data: [], error: null };
  check(names);
  const nameOf = new Map(((names.data ?? []) as { id: string; full_name: string }[]).map((n) => [n.id, n.full_name]));
  return rows.map((r) => {
    const x = Array.isArray(r.exercise_results) ? r.exercise_results[0] : r.exercise_results;
    return { id: r.id, student_id: r.student_id, student_name: nameOf.get(r.student_id) ?? 'Student', status: r.status, submitted_at: r.submitted_at, answers: r.answers ?? {},
      score: x ? Number(x.score) : null, max_score: x ? Number(x.max_score) : null, released: !!x?.released, per_question: x?.per_question ?? {} };
  });
}

export const reviewSubmission = (id: string, points: Record<string, number>, release: boolean) => rpc<void>('review_submission', { p_submission: id, p_points: points, p_release: release });
export const releaseAllResults = (exerciseId: string) => rpc<number>('release_exercise_results', { p_exercise: exerciseId });
export const resetSubmission = (id: string) => rpc<void>('reset_submission', { p_submission: id });

// ---- student ----
export interface StudentQuestion { id: string; qtype: QType; prompt: string; options: string[]; points: number }
export interface StudentExerciseView {
  exercise: ExerciseMeta; questions: StudentQuestion[];
  submission: { id: string; status: string; submitted_at: string; answers: Record<string, string> } | null;
  result: { score: number; max_score: number; per_question: Record<string, PerQuestion> } | null;
}

export async function listStudentExercises() {
  const [ex, subs, res] = await Promise.all([
    supabase.from('exercises').select('id, lesson_id, title, feedback, is_published').order('created_at', { ascending: false }),
    supabase.from('exercise_submissions').select('id, exercise_id, status'),
    supabase.from('exercise_results').select('submission_id, score, max_score'),
  ]);
  check(ex); check(subs); check(res);
  return {
    exercises: (ex.data ?? []) as ExerciseMeta[],
    submissions: new Map(((subs.data ?? []) as { id: string; exercise_id: string; status: string }[]).map((s) => [s.exercise_id, s])),
    results: new Map(((res.data ?? []) as { submission_id: string; score: number; max_score: number }[]).map((r) => [r.submission_id, r])),
  };
}

export async function getExerciseForStudent(id: string): Promise<StudentExerciseView | null> {
  const ex = await supabase.from('exercises').select('id, lesson_id, title, feedback, is_published').eq('id', id).maybeSingle();
  check(ex);
  if (!ex.data) return null;
  const [qs, sub] = await Promise.all([
    supabase.from('exercise_questions').select('id, qtype, prompt, options, points').eq('exercise_id', id).order('position'),
    supabase.from('exercise_submissions').select('id, status, submitted_at, answers').eq('exercise_id', id).maybeSingle(),
  ]);
  check(qs); check(sub);
  const submission = (sub.data as StudentExerciseView['submission']) ?? null;
  let result: StudentExerciseView['result'] = null;
  if (submission) {
    const r = await supabase.from('exercise_results').select('score, max_score, per_question').eq('submission_id', submission.id).maybeSingle();
    check(r);
    result = (r.data as StudentExerciseView['result']) ?? null; // empty until the teacher allows feedback
  }
  return {
    exercise: ex.data as ExerciseMeta, submission, result,
    questions: ((qs.data ?? []) as { id: string; qtype: QType; prompt: string; options: string[] | null; points: number }[]).map((q) => ({ ...q, options: q.options ?? [], points: Number(q.points) })),
  };
}

export const submitExercise = (exerciseId: string, answers: Record<string, string>) =>
  rpc<{ submission_id: string; released: boolean; score?: number; max_score?: number }>('submit_exercise', { p_exercise_id: exerciseId, p_answers: answers });
