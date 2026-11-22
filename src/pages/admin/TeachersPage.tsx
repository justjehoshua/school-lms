import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { KeyRound, Plus, UserCheck, UserX, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CredentialsDialog, type Credentials } from '@/components/common/CredentialsDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { TextField } from '@/components/forms/TextField';
import { TempPasswordField } from '@/components/forms/TempPasswordField';
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm';
import { useAsyncData } from '@/hooks/useAsyncData';
import { createTeacher, listAssignments, listPeople, setActive, type Assignment, type Person } from '@/services/peopleService';
import { friendlyError } from '@/lib/errors';
import { generatePassword } from '@/utils/password';

interface Bundle { people: Person[]; assignments: Assignment[] }
async function loadBundle(): Promise<Bundle> {
  const [people, assignments] = await Promise.all([listPeople('teacher'), listAssignments()]);
  return { people, assignments };
}

const schema = z.object({
  full_name: z.string().trim().min(2, 'Enter the full name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Values = z.infer<typeof schema>;

function AddTeacherForm({ onCreated, onCancel }: { onCreated: (c: Credentials) => void; onCancel: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { full_name: '', email: '', password: generatePassword() },
  });
  const onSubmit = async (v: Values) => {
    try {
      await createTeacher({ ...v, email: v.email.toLowerCase() });
      onCreated({ name: v.full_name, loginId: v.email.toLowerCase(), password: v.password });
    } catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField label="Full name" error={errors.full_name?.message} {...register('full_name')} />
      <TextField label="Email (used to sign in)" type="email" error={errors.email?.message} {...register('email')} />
      <TempPasswordField registration={register('password')} error={errors.password?.message}
        onGenerate={() => setValue('password', generatePassword(), { shouldValidate: true })} />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Create teacher</Button>
      </div>
    </form>
  );
}

export default function TeachersPage() {
  const { data, loading, error, reload } = useAsyncData(loadBundle);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<Person | null>(null);
  const [deactivating, setDeactivating] = useState<Person | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async (p: Person, active: boolean) => {
    setBusy(true);
    try { await setActive(p.id, active); toast.success(active ? 'Account activated' : 'Account deactivated'); setDeactivating(null); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Teachers" description="Create teacher accounts. Assign them to classes and subjects on the Assignments page."
        actions={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add teacher</Button>} />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.people.length === 0 ? (
          <EmptyState icon={Users} title="No teachers yet" description="Add a teacher to give them a login."
            action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add teacher</Button>} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Name</th><th className="hidden px-4 py-3 md:table-cell">Email</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.people.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.full_name}</td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">{p.email}</td>
                    <td className="px-4 py-3">{data.assignments.filter((a) => a.teacher_id === p.id).length}</td>
                    <td className="px-4 py-3"><Badge tone={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Active' : 'Deactivated'}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" aria-label={`Reset password for ${p.full_name}`} onClick={() => setResetting(p)}><KeyRound className="h-4 w-4" /></Button>
                      {p.is_active
                        ? <Button variant="ghost" size="sm" aria-label={`Deactivate ${p.full_name}`} onClick={() => setDeactivating(p)}><UserX className="h-4 w-4 text-red-600" /></Button>
                        : <Button variant="ghost" size="sm" aria-label={`Activate ${p.full_name}`} disabled={busy} onClick={() => void toggle(p, true)}><UserCheck className="h-4 w-4 text-emerald-600" /></Button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

      <Modal open={adding} title="Add teacher" onClose={() => setAdding(false)}>
        {adding && <AddTeacherForm onCancel={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreds(c); void reload(); }} />}
      </Modal>
      <Modal open={!!resetting} title={`Reset password: ${resetting?.full_name ?? ''}`} onClose={() => setResetting(null)}>
        {resetting && <ResetPasswordForm userId={resetting.id} onCancel={() => setResetting(null)}
          onDone={(password) => { setCreds({ name: resetting.full_name, loginId: resetting.email ?? '', password }); setResetting(null); }} />}
      </Modal>
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <ConfirmDialog open={!!deactivating} title="Deactivate this teacher?" confirmLabel="Deactivate" loading={busy}
        message={`${deactivating?.full_name} will be signed out and unable to sign in. Their lessons are kept, and you can reactivate them any time.`}
        onConfirm={() => deactivating && void toggle(deactivating, false)} onCancel={() => setDeactivating(null)} />
    </>
  );
}
