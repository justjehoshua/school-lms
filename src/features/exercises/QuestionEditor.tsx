import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import type { QType, QuestionDraft } from '@/services/exerciseService';

const TYPE_LABEL: Record<QType, string> = { multiple_choice: 'Multiple choice', true_false: 'True or false', short_answer: 'Short answer' };

export function QuestionEditor({ q, index, total, disabled, onChange, onMove, onDelete }: {
  q: QuestionDraft; index: number; total: number; disabled: boolean;
  onChange: (patch: Partial<QuestionDraft>) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
}) {
  const setOption = (i: number, text: string) => {
    const options = q.options.map((o, j) => (j === i ? text : o));
    onChange({ options, correct: q.correct === q.options[i] ? text : q.correct });
  };
  const removeOption = (i: number) => onChange({ options: q.options.filter((_, j) => j !== i), correct: q.correct === q.options[i] ? '' : q.correct });
  const changeType = (qtype: QType) => onChange({ qtype, correct: '', options: qtype === 'multiple_choice' ? (q.options.length >= 2 ? q.options : ['', '']) : [] });
  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-50';

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{index + 1}</span>
          <select aria-label={`Type of question ${index + 1}`} value={q.qtype} disabled={disabled} onChange={(e) => changeType(e.target.value as QType)} className={`${field} h-9 w-auto`}>
            {(Object.keys(TYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">Points
            <input type="number" min={0.5} step={0.5} value={q.points} disabled={disabled} onChange={(e) => onChange({ points: Number(e.target.value) })} className={`${field} h-9 w-20`} /></label>
        </div>
        {!disabled && (
          <div className="flex gap-0.5">
            <Button variant="ghost" size="sm" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" aria-label={`Delete question ${index + 1}`} onClick={onDelete}><Trash2 className="h-4 w-4 text-red-600" /></Button>
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`q-${q.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">Question</label>
        <textarea id={`q-${q.id}`} rows={2} value={q.prompt} disabled={disabled} maxLength={2000} onChange={(e) => onChange({ prompt: e.target.value })} className={`${field} py-2`} />
      </div>

      {q.qtype === 'multiple_choice' && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Options (select the correct one)</legend>
          <div className="space-y-2">
            {q.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name={`correct-${q.id}`} aria-label={`Option ${i + 1} is correct`} disabled={disabled || !o.trim()} checked={!!o.trim() && q.correct === o} onChange={() => onChange({ correct: o })} className="h-4 w-4" />
                <input value={o} disabled={disabled} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1} text`} className={`${field} h-10`} />
                {!disabled && q.options.length > 2 && <Button variant="ghost" size="sm" aria-label={`Remove option ${i + 1}`} onClick={() => removeOption(i)}><X className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
          {!disabled && q.options.length < 6 && <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange({ options: [...q.options, ''] })}><Plus className="h-4 w-4" aria-hidden /> Add option</Button>}
        </fieldset>
      )}

      {q.qtype === 'true_false' && (
        <fieldset className="flex gap-6 text-sm text-slate-700"><legend className="mb-1.5 font-medium">Correct answer</legend>
          {(['true', 'false'] as const).map((v) => (
            <label key={v} className="inline-flex items-center gap-2"><input type="radio" name={`tf-${q.id}`} disabled={disabled} checked={q.correct === v} onChange={() => onChange({ correct: v })} className="h-4 w-4" />{v === 'true' ? 'True' : 'False'}</label>))}
        </fieldset>
      )}

      {q.qtype === 'short_answer' && (
        <div>
          <label htmlFor={`m-${q.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">Model answer (optional, for your marking)</label>
          <textarea id={`m-${q.id}`} rows={2} value={q.correct} disabled={disabled} onChange={(e) => onChange({ correct: e.target.value })} className={`${field} py-2`} />
          <p className="mt-1 text-xs text-slate-500">Short answers are marked by you. They are never auto-marked.</p>
        </div>
      )}

      <div>
        <label htmlFor={`e-${q.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">Explanation (optional, shown to students when feedback is released)</label>
        <textarea id={`e-${q.id}`} rows={2} value={q.explanation} disabled={disabled} onChange={(e) => onChange({ explanation: e.target.value })} className={`${field} py-2`} />
      </div>
    </Card>
  );
}
