import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { deleteClass, listClasses, listClassSubjects, listSubjects, saveClass, type ClassRow, type ClassSubject, type Subject } from '@/services/adminService';
import { friendlyError } from '@/lib/errors';

interface Bundle { classes: ClassRow[]; subjects: Subject[]; links: ClassSubject[] }
async function loadBundle(): Promise<Bundle> {
  const [classes, subjects, links] = await Promise.all([listClasses(), listSubjects(), listClassSubjects()]);
  return { classes, subjects, links };
}

const schema = z.object({ name: z.string().trim().min(1, 'Enter a class name').max(60) });
type Values = z.infer<typeof schema>;

function ClassForm({ initial, subjects, selected, onSaved, onCancel }: {
  initial: ClassRow | null; subjects: Subject[]; selected: string[]; onSaved: () => void; onCancel: () => void;
}) {
  const { profile } = useAuth();
  const [chosen, setChosen] = useState<Set<string>>(new Set(selected));
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { name: initial?.name ?? '' },
  });
  const toggle = (id: string) => setChosen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const onSubmit = async (v: Values) => {
    try {
      await saveClass(profile!.school_id, initial?.id ?? null, v.name, [...chosen]);
      toast.success(initial ? 'Class updated' : 'Class added');
      onSaved();
    } catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <TextField label="Class name" placeholder="e.g. Basic 5" error={errors.name?.message} {...register('name')} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Subjects taught in this class</legend>
        {subjects.length === 0 ? <p className="text-sm text-slate-500">Add subjects first, then come back to assign them.</p> : (
          <div className="grid max-h-60 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
            {subjects.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={chosen.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 rounded border-slate-300" />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{initial ? 'Save changes' : 'Add class'}</Button>
      </div>
    </form>
  );
}

export default function ClassesPage() {
  const { data, loading, error, reload } = useAsyncData(loadBundle);
  const [editing, setEditing] = useState<ClassRow | null | 'new'>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [busy, setBusy] = useState(false);

  const subjectName = new Map((data?.subjects ?? []).map((s) => [s.id, s.name]));
  const subjectsOf = (classId: string) => (data?.links ?? []).filter((l) => l.class_id === classId).map((l) => l.subject_id);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await deleteClass(deleting.id); toast.success('Class deleted'); setDeleting(null); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Classes" description="Create classes and choose which subjects each one studies."
        actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add class</Button>} />
      {loading && !data ? <div className="py-16 flex justify-center"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.classes.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No classes yet" description="Add a class such as Basic 5, then pick its subjects."
            action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" aria-hidden /> Add class</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.classes.map((c) => {
              const ids = subjectsOf(c.id);
              return (
                <Card key={c.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
                    <div className="flex">
                      <Button variant="ghost" size="sm" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${c.name}`} onClick={() => setDeleting(c)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{ids.length} subject{ids.length === 1 ? '' : 's'}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ids.length === 0 ? <span className="text-sm text-slate-400">No subjects assigned</span>
                      : ids.map((id) => <Badge key={id} tone="blue">{subjectName.get(id) ?? 'Subject'}</Badge>)}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add class' : 'Edit class'} onClose={() => setEditing(null)}>
        {editing !== null && data && (
          <ClassForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} subjects={data.subjects}
            selected={editing === 'new' ? [] : subjectsOf(editing.id)}
            onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Delete class?" loading={busy}
        message={`"${deleting?.name}" and its subject links will be removed. A class with students or lessons cannot be deleted.`}
        onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(null)} />
    </>
  );
}
