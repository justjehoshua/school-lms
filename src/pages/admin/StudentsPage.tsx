import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { GraduationCap, KeyRound, Plus, Repeat, Search, UserCheck, UserX } from 'lucide-react';
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
import { SelectField } from '@/components/forms/SelectField';
import { TempPasswordField } from '@/components/forms/TempPasswordField';
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { listClasses, listSessions, type ClassRow, type Period } from '@/services/adminService';
import { assignStudentClass, createStudent, listEnrollments, listPeople, setActive, type Enrollment, type Person } from '@/services/peopleService';
import { identifierToEmail } from '@/services/authService';
import { friendlyError } from '@/lib/errors';
import { generatePassword } from '@/utils/password';

interface Bundle { students: Person[]; classes: ClassRow[]; session: Period | null; enrollments: Enrollment[] }
async function loadBundle(): Promise<Bundle> {
  const [students, classes, sessions] = await Promise.all([listPeople('student'), listClasses(), listSessions()]);
  const session = sessions.find((s) => s.is_current) ?? null;
  const enrollments = session ? await listEnrollments(session.id) : [];
  return { students, classes, session, enrollments };
}

const addSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the full name'),
  registration_number: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, '3 to 30 letters, numbers, dots, dashes or underscores'),
  class_id: z.string().min(1, 'Choose a class'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type AddValues = z.infer<typeof addSchema>;

function AddStudentForm({ classes, sessionId, onCreated, onCancel }: { classes: ClassRow[]; sessionId: string; onCreated: (c: Credentials) => void; onCancel: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<AddValues>({
    resolver: zodResolver(addSchema), defaultValues: { full_name: '', registration_number: '', class_id: '', password: generatePassword() },
  });
  const onSubmit = async (v: AddValues) => {
    try {
      await createStudent({ ...v, session_id: sessionId });
      onCreated({ name: v.full_name, loginId: v.registration_number, password: v.password });
    } catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TextField label="Full name" error={errors.full_name?.message} {...register('full_name')} />
      <TextField label="Registration number (used to sign in)" error={errors.registration_number?.message} {...register('registration_number')} />
      <SelectField label="Class" placeholder="Choose a class" options={classes.map((c) => ({ value: c.id, label: c.name }))} error={errors.class_id?.message} {...register('class_id')} />
      <TempPasswordField registration={register('password')} error={errors.password?.message}
        onGenerate={() => setValue('password', generatePassword(), { shouldValidate: true })} />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Create student</Button>
      </div>
    </form>
  );
}

function ChangeClassForm({ student, classes, current, sessionId, onDone, onCancel }: {
  student: Person; classes: ClassRow[]; current: string; sessionId: string; onDone: () => void; onCancel: () => void;
}) {
  const { profile } = useAuth();
  const [classId, setClassId] = useState(current);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!classId) return;
    setSaving(true);
    try { await assignStudentClass(profile!.school_id, student.id, sessionId, classId); toast.success('Class updated'); onDone(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <SelectField label="Class" placeholder="Choose a class" value={classId} onChange={(e) => setClassId(e.target.value)} options={classes.map((c) => ({ value: c.id, label: c.name }))} />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={saving} disabled={!classId} onClick={() => void save()}>Save</Button>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const { data, loading, error, reload } = useAsyncData(loadBundle);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<Person | null>(null);
  const [resetting, setResetting] = useState<Person | null>(null);
  const [deactivating, setDeactivating] = useState<Person | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const classOf = useMemo(() => new Map((data?.enrollments ?? []).map((e) => [e.student_id, e.class_id])), [data]);
  const className = useMemo(() => new Map((data?.classes ?? []).map((c) => [c.id, c.name])), [data]);
  const visible = (data?.students ?? []).filter((s) => {
    const q = query.trim().toLowerCase();
    const matches = !q || s.full_name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q);
    return matches && (!classFilter || classOf.get(s.id) === classFilter);
  });

  const toggle = async (p: Person, active: boolean) => {
    setBusy(true);
    try { await setActive(p.id, active); toast.success(active ? 'Account activated' : 'Account deactivated'); setDeactivating(null); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const ready = !!data && !!data.session && data.classes.length > 0;

  return (
    <>
      <PageHeader title="Students" description={data?.session ? `Current session: ${data.session.name}` : 'Create student accounts and place them in classes.'}
        actions={<Button disabled={!ready} onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add student</Button>} />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && !data.session ? (
          <EmptyState icon={GraduationCap} title="Set a current session first" description="Students are placed in a class for the current academic session."
            action={<Link to="/admin/terms"><Button>Go to Sessions &amp; Terms</Button></Link>} />
        ) : data && data.classes.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Add a class first" description="Create at least one class so students can be placed in it."
            action={<Link to="/admin/classes"><Button>Go to Classes</Button></Link>} />
        ) : data && data.students.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students yet" description="Add your first student to give them a login."
            action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add student</Button>} />
        ) : data && (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input type="search" aria-label="Search students" placeholder="Search by name or registration number" value={query} onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" />
              </div>
              <select aria-label="Filter by class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                <option value="">All classes</option>
                {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Registration no.</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No students match your search.</td></tr>}
                  {visible.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{s.registration_number}</td>
                      <td className="px-4 py-3">{className.get(classOf.get(s.id) ?? '') ?? <Badge tone="amber">Not placed</Badge>}</td>
                      <td className="px-4 py-3"><Badge tone={s.is_active ? 'green' : 'gray'}>{s.is_active ? 'Active' : 'Deactivated'}</Badge></td>
                      <td className="px-4 py-3"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label={`Change class for ${s.full_name}`} onClick={() => setMoving(s)}><Repeat className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Reset password for ${s.full_name}`} onClick={() => setResetting(s)}><KeyRound className="h-4 w-4" /></Button>
                        {s.is_active
                          ? <Button variant="ghost" size="sm" aria-label={`Deactivate ${s.full_name}`} onClick={() => setDeactivating(s)}><UserX className="h-4 w-4 text-red-600" /></Button>
                          : <Button variant="ghost" size="sm" aria-label={`Activate ${s.full_name}`} disabled={busy} onClick={() => void toggle(s, true)}><UserCheck className="h-4 w-4 text-emerald-600" /></Button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}

      <Modal open={adding} title="Add student" onClose={() => setAdding(false)}>
        {adding && data?.session && <AddStudentForm classes={data.classes} sessionId={data.session.id} onCancel={() => setAdding(false)}
          onCreated={(c) => { setAdding(false); setCreds(c); void reload(); }} />}
      </Modal>
      <Modal open={!!moving} title={`Change class: ${moving?.full_name ?? ''}`} onClose={() => setMoving(null)}>
        {moving && data?.session && <ChangeClassForm student={moving} classes={data.classes} current={classOf.get(moving.id) ?? ''} sessionId={data.session.id}
          onCancel={() => setMoving(null)} onDone={() => { setMoving(null); void reload(); }} />}
      </Modal>
      <Modal open={!!resetting} title={`Reset password: ${resetting?.full_name ?? ''}`} onClose={() => setResetting(null)}>
        {resetting && <ResetPasswordForm userId={resetting.id} onCancel={() => setResetting(null)}
          onDone={(password) => { setCreds({ name: resetting.full_name, loginId: resetting.registration_number ?? identifierToEmail(''), password }); setResetting(null); }} />}
      </Modal>
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <ConfirmDialog open={!!deactivating} title="Deactivate this student?" confirmLabel="Deactivate" loading={busy}
        message={`${deactivating?.full_name} will be signed out and unable to sign in. Their progress is kept, and you can reactivate them any time.`}
        onConfirm={() => deactivating && void toggle(deactivating, false)} onCancel={() => setDeactivating(null)} />
    </>
  );
}
