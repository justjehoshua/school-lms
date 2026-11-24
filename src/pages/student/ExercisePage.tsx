import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Clock, ListChecks, Lock, XCircle } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { getExerciseForStudent, submitExercise, type StudentExerciseView } from '@/services/exerciseService';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';

const label = (v: unknown) => (typeof v === 'string' ? (v === 'true' ? 'True' : v === 'false' ? 'False' : v) : Array.isArray(v) ? v.join(', ') : '');

function Questions({ view, onSubmitted }: { view: StudentExerciseView; onSubmitted: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const answered = view.questions.filter((q) => (answers[q.id] ?? '').trim()).length;
  useUnsavedWarning(answered > 0 && !saving);

  const submit = async () => {
    setSaving(true);
    try { await submitExercise(view.exercise.id, answers); toast.success('Answers submitted'); onSubmitted(); }
    catch (e) { toast.error(friendlyError(e)); setConfirming(false); }
    finally { setSaving(false); }
  };
  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <div className="space-y-4">
      {view.questions.map((q, i) => (
        <Card key={q.id} className="p-5">
          <fieldset>
            <legend className="text-base font-medium text-slate-900">{i + 1}. {q.prompt} <span className="ml-1 text-sm font-normal text-slate-500">({q.points} point{q.points === 1 ? '' : 's'})</span></legend>
            <div className="mt-3 space-y-2">
              {(q.qtype === 'multiple_choice' ? q.options : q.qtype === 'true_false' ? ['true', 'false'] : []).map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => set(q.id, o)} className="h-4 w-4" />{label(o)}</label>))}
              {q.qtype === 'short_answer' && <textarea aria-label={`Answer to question ${i + 1}`} rows={3} maxLength={2000} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Type your answer" />}
            </div>
          </fieldset>
        </Card>))}
      <div className="flex items-center justify-between"><p className="text-sm text-slate-600">{answered} of {view.questions.length} answered</p>
        <Button size="lg" onClick={() => setConfirming(true)}>Submit answers</Button></div>
      <ConfirmDialog open={confirming} title="Submit your answers?" confirmLabel="Submit" loading={saving}
        message={`${answered < view.questions.length ? `You have left ${view.questions.length - answered} question${view.questions.length - answered === 1 ? '' : 's'} unanswered. ` : ''}You cannot change your answers after submitting.`}
        onConfirm={() => void submit()} onCancel={() => setConfirming(false)} />
    </div>
  );
}

function Feedback({ view }: { view: StudentExerciseView }) {
  const { result, submission } = view;
  if (!submission) return null;
  if (!result) return (
    <Card className="flex items-start gap-3 p-5"><Clock className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden />
      <div><p className="font-semibold text-slate-900">Submitted</p><p className="text-sm text-slate-600">You submitted on {formatDateTime(submission.submitted_at)}. Your teacher will share your results when they are ready.</p></div></Card>);
  const pct = result.max_score ? Math.round((result.score / result.max_score) * 100) : 0;
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">Your score</p><p className="text-3xl font-bold text-slate-900">{result.score} <span className="text-lg font-medium text-slate-500">/ {result.max_score}</span></p></div><Badge tone={pct >= 50 ? 'green' : 'amber'}>{pct}%</Badge></Card>
      {view.questions.map((q, i) => {
        const r = result.per_question[q.id];
        const mine = submission.answers[q.id];
        return (
          <Card key={q.id} className="p-5">
            <div className="flex items-start justify-between gap-3"><p className="font-medium text-slate-900">{i + 1}. {q.prompt}</p>
              {q.qtype === 'short_answer' ? <Badge tone="blue">{r?.points ?? 0} / {q.points}</Badge> : r?.correct ? <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden /> Correct</span> : <span className="flex items-center gap-1 text-sm font-semibold text-red-700"><XCircle className="h-4 w-4" aria-hidden /> Incorrect</span>}</div>
            <p className="mt-2 text-sm text-slate-600">Your answer: <span className="font-medium text-slate-900">{mine?.trim() ? label(mine) : 'No answer'}</span></p>
            {q.qtype !== 'short_answer' && !r?.correct && <p className="mt-1 text-sm text-slate-600">Correct answer: <span className="font-medium text-slate-900">{label(r?.correct_answer)}</span></p>}
            {q.qtype === 'short_answer' && !!r?.correct_answer && <p className="mt-1 text-sm text-slate-600">Model answer: <span className="font-medium text-slate-900">{label(r.correct_answer)}</span></p>}
            {r?.explanation && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{r.explanation}</p>}
          </Card>);
      })}
    </div>
  );
}

export default function ExercisePage() {
  const { id } = useParams();
  const load = useCallback(() => (id ? getExerciseForStudent(id) : Promise.resolve(null)), [id]);
  const { data, loading, error, reload } = useAsyncData(load);
  if (loading && !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyState icon={Lock} title="This exercise is not available" description="It may not be published yet, or its lesson may have closed." action={<Link to="/student/exercises"><Button>Back to exercises</Button></Link>} />;
  return (
    <>
      <Link to="/student/exercises" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> Exercises</Link>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{data.exercise.title}</h1>
      <p className="mb-5 flex items-center gap-2 text-sm text-slate-500"><ListChecks className="h-4 w-4" aria-hidden /> {data.questions.length} question{data.questions.length === 1 ? '' : 's'}</p>
      {data.submission ? <Feedback view={data} /> : <Questions view={data} onSubmitted={() => void reload()} />}
    </>
  );
}
