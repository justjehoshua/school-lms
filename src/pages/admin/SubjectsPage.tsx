import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { deleteSubject, listSubjects, saveSubject, type Subject } from '@/services/adminService';
import { friendlyError } from '@/lib/errors';
import { SUBJECT_ICONS, subjectIcon } from '@/utils/subjectIcons';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  description: z.string().max(500, 'Keep it under 500 characters'),
  icon: z.string(),
});
type Values = z.infer<typeof schema>;

function SubjectForm({ initial, onSaved, onCancel }: { initial: Subject | null; onSaved: () => void; onCancel: () => void }) {
  const { profile } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', description: initial?.description ?? '', icon: initial?.icon ?? '' },
  });
  const onSubmit = async (v: Values) => {
    try {
      await saveSubject(profile!.school_id, initial?.id ?? null, v);
      toast.success(initial ? 'Subject updated' : 'Subject added');
      onSaved();
    } catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField label="Subject name" placeholder="e.g. Mathematics" error={errors.name?.message} {...register('name')} />
      <TextAreaField label="Description (optional)" error={errors.description?.message} {...register('description')} />
      <div>
        <label htmlFor="icon" className="mb-1.5 block text-sm font-medium text-slate-700">Icon (optional)</label>
        <select id="icon" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" {...register('icon')}>
          <option value="">Default (book)</option>
          {Object.entries(SUBJECT_ICONS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{initial ? 'Save changes' : 'Add subject'}</Button>
      </div>
    </form>
  );
}

export default function SubjectsPage() {
  const { data, loading, error, reload } = useAsyncData(listSubjects);
  const [editing, setEditing] = useState<Subject | null | 'new'>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await deleteSubject(deleting.id); toast.success('Subject deleted'); setDeleting(null); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Subjects" description="Create the subjects your school teaches. You assign them to classes on the Classes page."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add subject</Button>} />
      {loading && !data ? <div className="py-16 flex justify-center"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.length === 0 ? (
          <EmptyState icon={Library} title="No subjects yet" description="Add your first subject, for example Mathematics or English Language."
            action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add subject</Button>} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Subject</th><th className="hidden px-4 py-3 sm:table-cell">Description</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.map((s) => { const Icon = subjectIcon(s.icon); return (
                  <tr key={s.id}>
                    <td className="px-4 py-3"><div className="flex items-center gap-3 font-medium text-slate-900">
                      <span className="rounded-lg bg-brand-50 p-2 text-brand-700"><Icon className="h-4 w-4" aria-hidden /></span>{s.name}</div></td>
                    <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{s.description ?? '—'}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div></td>
                  </tr>); })}
              </tbody>
            </table>
          </Card>
        )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add subject' : 'Edit subject'} onClose={() => setEditing(null)}>
        {editing !== null && <SubjectForm initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete subject?" loading={busy}
        message={`"${deleting?.name}" will be removed from every class. Lessons already written for it will block deletion.`}
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
    </>
  );
}
