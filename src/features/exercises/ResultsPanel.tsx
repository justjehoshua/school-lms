import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, RotateCcw, Send } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { listSubmissions, releaseAllResults, resetSubmission, reviewSubmission, type QuestionDraft, type SubmissionRow } from '@/services/exerciseService';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';

function ReviewForm({ sub, questions, onDone, onCancel }: { sub: SubmissionRow; questions: QuestionDraft[]; onDone: () => void; onCancel: () => void }) {
  const shortQs = questions.filter((q) => q.qtype === 'short_answer');
  const [points, setPoints] = useState<Record<string, number>>(() => Object.fromEntries(shortQs.map((q) => [q.id, sub.per_question[q.id]?.points ?? 0])));
  const [saving, setSaving] = useState(false);

  const save = async (release: boolean) => {
    setSaving(true);
    try { await reviewSubmission(sub.id, points, release); toast.success(release ? 'Saved and released to the student' : 'Saved. The student cannot see it yet'); onDone(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const given = sub.answers[q.id];
        const res = sub.per_question[q.id];
        return (
          <div key={q.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-900">{i + 1}. {q.prompt}</p>
            <p className="mt-1 text-slate-600">Answer: <span className="font-medium text-slate-900">{given?.trim() ? given : 'No answer'}</span></p>
            {q.qtype !== 'short_answer' ? (
              <p className="mt-1">{res?.correct ? <Badge tone="green">Correct</Badge> : <Badge tone="red">Incorrect</Badge>} <span className="ml-2 text-slate-500">Correct answer: {q.correct}</span></p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-slate-700">Points (max {q.points})
                  <input type="number" min={0} max={q.points} step={0.5} value={points[q.id] ?? 0} onChange={(e) => setPoints((p) => ({ ...p, [q.id]: Math.max(0, Math.min(q.points, Number(e.target.value))) }))} className="h-9 w-20 rounded-lg border border-slate-300 px-2" /></label>
                {q.correct && <span className="text-slate-500">Model answer: {q.correct}</span>}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="secondary" loading={saving} onClick={() => void save(false)}>Save, keep hidden</Button>
        <Button loading={saving} onClick={() => void save(true)}><Send className="h-4 w-4" aria-hidden /> Save and release</Button>
      </div>
    </div>
  );
}

export function ResultsPanel({ exerciseId, questions }: { exerciseId: string; questions: QuestionDraft[] }) {
  const load = useCallback(() => listSubmissions(exerciseId), [exerciseId]);
  const { data, loading, error, reload } = useAsyncData(load);
  const [reviewing, setReviewing] = useState<SubmissionRow | null>(null);
  const [resetting, setResetting] = useState<SubmissionRow | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  const rows = data ?? [];
  if (rows.length === 0) return <EmptyState icon={ClipboardCheck} title="No submissions yet" description="Once students submit, their answers and scores appear here." />;
  const marked = rows.filter((r) => r.status === 'marked' && r.max_score);
  const avg = marked.length ? Math.round(marked.reduce((n, r) => n + ((r.score ?? 0) / (r.max_score ?? 1)) * 100, 0) / marked.length) : null;
  const unreleased = rows.filter((r) => r.status === 'marked' && !r.released).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">{rows.length} submission{rows.length === 1 ? '' : 's'}{avg !== null ? ` · average ${avg}%` : ''}</p>
        <Button variant="secondary" disabled={busy || unreleased === 0} onClick={() => void run(() => releaseAllResults(exerciseId), 'Results released')}><Send className="h-4 w-4" aria-hidden /> Release {unreleased} marked result{unreleased === 1 ? '' : 's'}</Button>
      </div>
      <Card className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-medium text-slate-900">{r.student_name}</td>
            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(r.submitted_at)}</td>
            <td className="px-4 py-3">{r.status === 'marked' && r.score !== null ? `${r.score} / ${r.max_score}` : '—'}</td>
            <td className="px-4 py-3">{r.status === 'needs_review' ? <Badge tone="amber">Needs review</Badge> : r.released ? <Badge tone="green">Released</Badge> : <Badge tone="gray">Marked, hidden</Badge>}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setReviewing(r)}>{r.status === 'needs_review' ? 'Review' : 'View'}</Button>
              <Button variant="ghost" size="sm" aria-label={`Allow ${r.student_name} to retry`} onClick={() => setResetting(r)}><RotateCcw className="h-4 w-4" /></Button>
            </div></td>
          </tr>))}</tbody></table></Card>

      <Modal open={!!reviewing} title={`${reviewing?.student_name ?? ''}'s answers`} onClose={() => setReviewing(null)}>
        {reviewing && <ReviewForm key={reviewing.id} sub={reviewing} questions={questions} onCancel={() => setReviewing(null)} onDone={() => { setReviewing(null); void reload(); }} />}
      </Modal>
      <ConfirmDialog open={!!resetting} title="Allow another attempt?" confirmLabel="Remove submission" loading={busy}
        message={`${resetting?.student_name}'s submission and score will be deleted so they can answer again.`}
        onConfirm={() => { const r = resetting; if (r) void run(() => resetSubmission(r.id), 'Submission removed').then(() => setResetting(null)); }} onCancel={() => setResetting(null)} />
    </div>
  );
}
