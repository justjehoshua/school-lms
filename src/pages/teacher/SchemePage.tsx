import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowUp, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { TextField } from '@/components/forms/TextField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { SelectField } from '@/components/forms/SelectField';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { loadTeacherContext } from '@/features/schemes/useTeacherContext';
import { deleteTopic, ensureScheme, findScheme, listTopics, reorderTopics, saveTopic, setTopicStatus, type Topic, type TopicStatus } from '@/services/teacherService';
import { friendlyError } from '@/lib/errors';
import { formatDate } from '@/utils/format';

const schema = z.object({
  week_number: z.number({ invalid_type_error: 'Enter a week number' }).int().min(1, 'Weeks start at 1').max(30, 'Maximum is week 30'),
  title: z.string().trim().min(2, 'Enter a topic title').max(200),
  description: z.string().max(1000, 'Keep it under 1000 characters'),
  objectives: z.string().max(1000, 'Keep it under 1000 characters'),
  expected_date: z.string(),
});
type Values = z.infer<typeof schema>;

function TopicForm({ initial, defaultWeek, onSubmit, onCancel }: {
  initial: Topic | null; defaultWeek: number; onSubmit: (v: Values) => Promise<void>; onCancel: () => void;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      week_number: initial?.week_number ?? defaultWeek, title: initial?.title ?? '',
      description: initial?.description ?? '', objectives: initial?.objectives ?? '', expected_date: initial?.expected_date ?? '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Week" type="number" min={1} max={30} error={errors.week_number?.message} {...register('week_number', { valueAsNumber: true })} />
        <div className="sm:col-span-2"><TextField label="Topic" placeholder="e.g. Fractions" error={errors.title?.message} {...register('title')} /></div>
      </div>
      <TextAreaField label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <TextAreaField label="Learning objectives (optional)" error={errors.objectives?.message} {...register('objectives')} />
      <TextField label="Expected teaching date (optional)" type="date" {...register('expected_date')} />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{initial ? 'Save changes' : 'Add topic'}</Button>
      </div>
    </form>
  );
}

const STATUS_LABEL: Record<TopicStatus, string> = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed' };

export default function SchemePage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const ctxState = useAsyncData(loadTeacherContext);
  const ctx = ctxState.data;

  const [classId, setClassId] = useState(params.get('class') ?? '');
  const [subjectId, setSubjectId] = useState(params.get('subject') ?? '');
  const [termId, setTermId] = useState('');
  const effectiveTermId = termId || ctx?.currentTerm?.id || '';

  const loadTopics = useCallback(async () => {
    if (!classId || !subjectId || !effectiveTermId) return { schemeId: null as string | null, topics: [] as Topic[] };
    const schemeId = await findScheme(classId, subjectId, effectiveTermId);
    return { schemeId, topics: schemeId ? await listTopics(schemeId) : [] };
  }, [classId, subjectId, effectiveTermId]);
  const topicState = useAsyncData(loadTopics);

  const [editing, setEditing] = useState<Topic | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Topic | null>(null);
  const [busy, setBusy] = useState(false);

  const classOptions = useMemo(() => {
    if (!ctx) return [];
    return [...new Set(ctx.assignments.map((a) => a.class_id))].map((id) => ({ value: id, label: ctx.className.get(id) ?? 'Class' }));
  }, [ctx]);
  const subjectOptions = useMemo(() => {
    if (!ctx) return [];
    return ctx.assignments.filter((a) => a.class_id === classId).map((a) => ({ value: a.subject_id, label: ctx.subjectName.get(a.subject_id) ?? 'Subject' }));
  }, [ctx, classId]);
  const termOptions = useMemo(() => {
    if (!ctx) return [];
    return ctx.terms.map((t) => ({ value: t.id, label: `${ctx.sessions.find((s) => s.id === t.session_id)?.name ?? ''} · ${t.name}` }));
  }, [ctx]);

  const topics = topicState.data?.topics ?? [];
  const term = ctx?.terms.find((t) => t.id === effectiveTermId);
  const ready = !!classId && !!subjectId && !!effectiveTermId;

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await topicState.reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const submitTopic = async (v: Values) => {
    if (!profile || !term) return;
    try {
      const schemeId = topicState.data?.schemeId ?? await ensureScheme(profile.school_id, profile.id, classId, subjectId, term.session_id, term.id);
      const next = topics.length ? Math.max(...topics.map((t) => t.position)) + 1 : 0;
      await saveTopic(profile.school_id, schemeId, editing && editing !== 'new' ? editing.id : null, v, next);
      toast.success('Topic saved');
      setEditing(null);
      await topicState.reload();
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = topics.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => reorderTopics(ids));
  };

  return (
    <>
      <PageHeader title="Scheme of Work" description="Plan the topics for each class, subject and term." />
      {ctxState.loading && !ctx ? <div className="flex justify-center py-16"><Spinner /></div>
        : ctxState.error ? <ErrorState message={ctxState.error} onRetry={() => void ctxState.reload()} />
        : ctx && ctx.assignments.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No classes assigned yet" description="Ask your school administrator to assign you to a class and subject first." />
        ) : ctx && (
          <div className="space-y-5">
            <Card className="grid gap-4 p-5 md:grid-cols-3">
              <SelectField label="Class" placeholder="Choose class" value={classId} options={classOptions}
                onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }} />
              <SelectField label="Subject" placeholder={classId ? 'Choose subject' : 'Pick a class first'} disabled={!classId} value={subjectId} options={subjectOptions}
                onChange={(e) => setSubjectId(e.target.value)} />
              <SelectField label="Session and term" placeholder="Choose term" value={effectiveTermId} options={termOptions} onChange={(e) => setTermId(e.target.value)} />
            </Card>

            {!ready ? (
              <EmptyState icon={ClipboardList} title="Choose a class, subject and term" description={ctx.terms.length === 0 ? 'Your administrator has not set up any terms yet.' : 'Your scheme of work will appear here.'} />
            ) : topicState.loading && !topicState.data ? <div className="flex justify-center py-12"><Spinner /></div>
            : topicState.error ? <ErrorState message={topicState.error} onRetry={() => void topicState.reload()} />
            : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">{ctx.className.get(classId)} · {ctx.subjectName.get(subjectId)}</h2>
                  <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add topic</Button>
                </div>
                {topics.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="No topics yet" description="Add the first week's topic to start this scheme of work."
                    action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add topic</Button>} />
                ) : (
                  <Card className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3">Week</th><th className="px-4 py-3">Topic</th><th className="hidden px-4 py-3 lg:table-cell">Objectives</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topics.map((t, i) => (
                          <tr key={t.id} className="align-top">
                            <td className="px-4 py-3 font-semibold text-slate-900">{t.week_number}</td>
                            <td className="px-4 py-3"><p className="font-medium text-slate-900">{t.title}</p>{t.description && <p className="mt-0.5 max-w-xs text-slate-500">{t.description}</p>}</td>
                            <td className="hidden max-w-xs px-4 py-3 text-slate-500 lg:table-cell">{t.objectives ?? '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.expected_date ? formatDate(t.expected_date) : '—'}</td>
                            <td className="px-4 py-3">
                              <select aria-label={`Status for ${t.title}`} value={t.status} disabled={busy}
                                onChange={(e) => void run(() => setTopicStatus(t.id, e.target.value as TopicStatus))}
                                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
                                {(Object.keys(STATUS_LABEL) as TopicStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3"><div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="sm" aria-label="Move up" disabled={busy || i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" aria-label="Move down" disabled={busy || i === topics.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" aria-label={`Edit ${t.title}`} onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" aria-label={`Delete ${t.title}`} onClick={() => setDeleting(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
                <p className="text-sm text-slate-500">Students in this class can see these topics and dates. They cannot open a lesson until you publish it.</p>
              </>
            )}
          </div>
        )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add topic' : 'Edit topic'} onClose={() => setEditing(null)}>
        {editing !== null && <TopicForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing}
          defaultWeek={topics.length ? Math.min(30, Math.max(...topics.map((t) => t.week_number)) + 1) : 1} onSubmit={submitTopic} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete this topic?" loading={busy}
        message={`"${deleting?.title}" will be removed from the scheme of work. A lesson linked to it is kept.`}
        onConfirm={() => { const d = deleting; if (d) void run(() => deleteTopic(d.id), 'Topic deleted').then(() => setDeleting(null)); }} onCancel={() => setDeleting(null)} />
    </>
  );
}
