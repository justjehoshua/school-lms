import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { TextField } from '@/components/forms/TextField';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { deleteSession, deleteTerm, listSessions, listTerms, saveSession, saveTerm, setCurrentSession, setCurrentTerm, type Period, type Term } from '@/services/adminService';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/utils/format';

interface Bundle { sessions: Period[]; terms: Term[] }
async function loadBundle(): Promise<Bundle> {
  const [sessions, terms] = await Promise.all([listSessions(), listTerms()]);
  return { sessions, terms };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(60),
  start_date: z.string().min(1, 'Pick a start date'),
  end_date: z.string().min(1, 'Pick an end date'),
}).refine((v) => !v.start_date || !v.end_date || v.end_date > v.start_date, { path: ['end_date'], message: 'End date must be after the start date' });
type Values = z.infer<typeof schema>;

type Editing =
  | { kind: 'session'; item: Period | null }
  | { kind: 'term'; sessionId: string; item: Term | null };

function PeriodForm({ editing, onSaved, onCancel }: { editing: Editing; onSaved: () => void; onCancel: () => void }) {
  const { profile } = useAuth();
  const item = editing.item;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: item?.name ?? '', start_date: item?.start_date ?? '', end_date: item?.end_date ?? '' },
  });
  const onSubmit = async (v: Values) => {
    try {
      if (editing.kind === 'session') await saveSession(profile!.school_id, item?.id ?? null, v);
      else await saveTerm(profile!.school_id, editing.sessionId, item?.id ?? null, v);
      toast.success('Saved');
      onSaved();
    } catch (e) { toast.error(friendlyError(e)); }
  };
  const isSession = editing.kind === 'session';
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField label={isSession ? 'Session name' : 'Term name'} placeholder={isSession ? '2026/2027' : 'First Term'} error={errors.name?.message} {...register('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Starts" type="date" error={errors.start_date?.message} {...register('start_date')} />
        <TextField label="Ends" type="date" error={errors.end_date?.message} {...register('end_date')} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Save</Button>
      </div>
    </form>
  );
}

export default function TermsPage() {
  const { data, loading, error, reload } = useAsyncData(loadBundle);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'session' | 'term'; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const d = deleting;
    await run(() => (d.kind === 'session' ? deleteSession(d.id) : deleteTerm(d.id)), 'Deleted');
    setDeleting(null);
  };

  return (
    <>
      <PageHeader title="Sessions & Terms" description="Set up each academic year and its terms. Mark the current session and term so teachers see the right defaults."
        actions={<Button onClick={() => setEditing({ kind: 'session', item: null })}><Plus className="h-4 w-4" aria-hidden /> Add session</Button>} />
      {loading && !data ? <div className="py-16 flex justify-center"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.sessions.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No academic sessions yet" description="Start with the current school year, for example 2026/2027."
            action={<Button onClick={() => setEditing({ kind: 'session', item: null })}><Plus className="h-4 w-4" aria-hidden /> Add session</Button>} />
        ) : (
          <div className="space-y-5">
            {data?.sessions.map((s) => {
              const terms = data.terms.filter((t) => t.session_id === s.id);
              return (
                <Card key={s.id} className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-900">{s.name}</h2>
                        {s.is_current && <Badge tone="green">Current</Badge>}</div>
                      <p className="text-sm text-slate-500">{formatDate(s.start_date)} to {formatDate(s.end_date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {!s.is_current && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => setCurrentSession(s.id), 'Current session updated')}>Set as current</Button>}
                      <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: 'term', sessionId: s.id, item: null })}><Plus className="h-4 w-4" aria-hidden /> Add term</Button>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setEditing({ kind: 'session', item: s })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => setDeleting({ kind: 'session', id: s.id, name: s.name })}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </div>
                  <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {terms.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No terms yet. Add First Term, Second Term and Third Term.</p>}
                    {terms.map((t) => (
                      <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{t.name}</span>
                          {t.is_current && <Badge tone="green">Current</Badge>}
                          <span className="text-sm text-slate-500">{formatDate(t.start_date)} to {formatDate(t.end_date)}</span>
                        </div>
                        <div className="flex gap-1">
                          {!t.is_current && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => setCurrentTerm(t.id), 'Current term updated')}>Set as current</Button>}
                          <Button size="sm" variant="ghost" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ kind: 'term', sessionId: s.id, item: t })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" aria-label={`Delete ${t.name}`} onClick={() => setDeleting({ kind: 'term', id: t.id, name: t.name })}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal open={editing !== null} title={editing?.kind === 'term' ? (editing.item ? 'Edit term' : 'Add term') : (editing?.item ? 'Edit session' : 'Add session')} onClose={() => setEditing(null)}>
        {editing && <PeriodForm key={`${editing.kind}-${editing.item?.id ?? 'new'}`} editing={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={`Delete ${deleting?.kind ?? ''}?`} loading={busy}
        message={`"${deleting?.name}" will be removed${deleting?.kind === 'session' ? ' along with its terms' : ''}. Anything that uses it (enrolled students, lessons) will block deletion.`}
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
    </>
  );
}
