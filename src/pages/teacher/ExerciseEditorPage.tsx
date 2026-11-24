import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ListChecks, Plus, Save } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { TextField } from '@/components/forms/TextField';
import { QuestionEditor } from '@/features/exercises/QuestionEditor';
import { ResultsPanel } from '@/features/exercises/ResultsPanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { getLesson, type Lesson } from '@/services/lessonService';
import { getLessonExercise, getQuestionsForEdit, newQuestion, saveExercise, validateQuestions, type ExerciseMeta, type QuestionDraft, type QType } from '@/services/exerciseService';
import { friendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface Loaded { lesson: Lesson; exercise: ExerciseMeta | null; questions: QuestionDraft[]; hasSubmissions: boolean }

function Editor({ data, onSaved }: { data: Loaded; onSaved: () => void }) {
  const { lesson, exercise, hasSubmissions } = data;
  const [title, setTitle] = useState(exercise?.title ?? `${lesson.title}: exercise`);
  const [feedback, setFeedback] = useState<'immediate' | 'manual'>(exercise?.feedback ?? 'immediate');
  const [published, setPublished] = useState(exercise?.is_published ?? false);
  const [questions, setQuestions] = useState<QuestionDraft[]>(data.questions);
  const [newType, setNewType] = useState<QType>('multiple_choice');
  const [tab, setTab] = useState<'questions' | 'results'>('questions');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);
  const touch = () => setDirty(true);

  const patch = (id: string, p: Partial<QuestionDraft>) => { setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...p } : q))); touch(); };
  const move = (i: number, dir: -1 | 1) => { setQuestions((qs) => { const a = [...qs]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a; }); touch(); };

  const save = async () => {
    const problem = hasSubmissions ? null : validateQuestions(questions);
    if (problem) return void toast.error(problem);
    if (published && questions.length === 0) return void toast.error('Add at least one question before publishing.');
    setSaving(true);
    try {
      await saveExercise(lesson.id, exercise?.id ?? null, { title, feedback, is_published: published }, hasSubmissions ? null : questions);
      toast.success('Exercise saved');
      setDirty(false);
      onSaved();
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const total = questions.reduce((n, q) => n + (q.points || 0), 0);
  return (
    <>
      <Link to={`/teacher/lessons/${lesson.id}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> {lesson.title}</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-slate-900">Exercise</h1><p className="text-sm text-slate-500">{questions.length} question{questions.length === 1 ? '' : 's'} · {total} point{total === 1 ? '' : 's'}</p></div>
        <Button loading={saving} onClick={() => void save()}><Save className="h-4 w-4" aria-hidden /> Save exercise</Button>
      </div>

      {exercise && (
        <div className="mb-5 flex gap-1 border-b border-slate-200" role="tablist">
          {(['questions', 'results'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-semibold capitalize', tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t}</button>))}
        </div>
      )}

      {tab === 'results' && exercise ? <ResultsPanel exerciseId={exercise.id} questions={questions} /> : (
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <TextField label="Title" value={title} maxLength={200} onChange={(e) => { setTitle(e.target.value); touch(); }} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="fb" className="mb-1.5 block text-sm font-medium text-slate-700">When do students see their results?</label>
                <select id="fb" value={feedback} onChange={(e) => { setFeedback(e.target.value as 'immediate' | 'manual'); touch(); }} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="immediate">Immediately after submitting (quizzes without short answers)</option>
                  <option value="manual">Only when I release them</option></select>
                <p className="mt-1 text-xs text-slate-500">Exercises with short answers always wait for your review. Correct answers are never shown before results are released.</p></div>
              <label className="flex items-center gap-3 self-center text-sm font-medium text-slate-700"><input type="checkbox" checked={published} onChange={(e) => { setPublished(e.target.checked); touch(); }} className="h-4 w-4 rounded border-slate-300" />
                Published (visible to students who can open this lesson)</label>
            </div>
          </Card>

          {hasSubmissions && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Students have already submitted this exercise, so the questions are locked. You can still change the title, feedback setting and published state. Use the Results tab to allow retries.</p>}

          {questions.length === 0 ? <EmptyState icon={ListChecks} title="No questions yet" description="Add multiple-choice, true-or-false or short-answer questions." />
            : questions.map((q, i) => <QuestionEditor key={q.id} q={q} index={i} total={questions.length} disabled={hasSubmissions} onChange={(p) => patch(q.id, p)} onMove={(d) => move(i, d)} onDelete={() => { setQuestions((qs) => qs.filter((x) => x.id !== q.id)); touch(); }} />)}

          {!hasSubmissions && (
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Type of new question" value={newType} onChange={(e) => setNewType(e.target.value as QType)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                <option value="multiple_choice">Multiple choice</option><option value="true_false">True or false</option><option value="short_answer">Short answer</option></select>
              <Button variant="secondary" onClick={() => { setQuestions((qs) => [...qs, newQuestion(newType)]); touch(); }}><Plus className="h-4 w-4" aria-hidden /> Add question</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function ExerciseEditorPage() {
  const { id } = useParams();
  const load = useCallback(async (): Promise<Loaded | null> => {
    if (!id) return null;
    const lesson = await getLesson(id);
    if (!lesson) return null;
    const exercise = await getLessonExercise(id);
    const q = exercise ? await getQuestionsForEdit(exercise.id) : { questions: [], hasSubmissions: false };
    return { lesson, exercise, questions: q.questions, hasSubmissions: q.hasSubmissions };
  }, [id]);
  const { data, loading, error, reload } = useAsyncData(load);
  if (loading && !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyState icon={ListChecks} title="Lesson not found" description="It may have been deleted, or you may not have access." action={<Link to="/teacher/lessons"><Button>Back to lessons</Button></Link>} />;
  return <Editor key={data.exercise?.id ?? 'new'} data={data} onSaved={() => void reload()} />;
}
