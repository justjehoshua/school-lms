import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { SelectField } from '@/components/forms/SelectField';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { listClasses, listClassSubjects, listSubjects, type ClassRow, type ClassSubject, type Subject } from '@/services/adminService';
import { addAssignment, listAssignments, listPeople, removeAssignment, type Assignment, type Person } from '@/services/peopleService';
import { friendlyError } from '@/lib/errors';

interface Bundle { teachers: Person[]; classes: ClassRow[]; subjects: Subject[]; links: ClassSubject[]; assignments: Assignment[] }
async function loadBundle(): Promise<Bundle> {
  const [teachers, classes, subjects, links, assignments] = await Promise.all([
    listPeople('teacher'), listClasses(), listSubjects(), listClassSubjects(), listAssignments(),
  ]);
  return { teachers: teachers.filter((t) => t.is_active), classes, subjects, links, assignments };
}

export default function AssignmentsPage() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsyncData(loadBundle);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Assignment | null>(null);

  const subjectName = new Map((data?.subjects ?? []).map((s) => [s.id, s.name]));
  const className = new Map((data?.classes ?? []).map((c) => [c.id, c.name]));
  const teacherName = new Map((data?.teachers ?? []).map((t) => [t.id, t.full_name]));
  const subjectOptions = (data?.links ?? []).filter((l) => l.class_id === classId)
    .map((l) => ({ value: l.subject_id, label: subjectName.get(l.subject_id) ?? 'Subject' }));

  const add = async () => {
    if (!teacherId || !classId || !subjectId) return;
    setSaving(true);
    try {
      await addAssignment(profile!.school_id, teacherId, classId, subjectId);
      toast.success('Assignment added');
      setSubjectId('');
      await reload();
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setSaving(true);
    try { await removeAssignment(removing.id); toast.success('Assignment removed'); setRemoving(null); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const blocked = data && (data.teachers.length === 0 || data.classes.length === 0 || data.links.length === 0);

  return (
    <>
      <PageHeader title="Assignments" description="Choose which class and subject each teacher is responsible for. Teachers can only create lessons for what you assign here." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : blocked ? (
          <EmptyState icon={ClipboardList} title="Not ready to assign yet"
            description="You need at least one teacher, one class, and a class with subjects assigned to it."
            action={<div className="flex gap-3"><Link to="/admin/teachers"><Button variant="secondary">Teachers</Button></Link><Link to="/admin/classes"><Button>Classes</Button></Link></div>} />
        ) : data && (
          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-slate-900">Add an assignment</h2>
              <div className="grid gap-4 md:grid-cols-4 md:items-end">
                <SelectField label="Teacher" placeholder="Choose teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} options={data.teachers.map((t) => ({ value: t.id, label: t.full_name }))} />
                <SelectField label="Class" placeholder="Choose class" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }} options={data.classes.map((c) => ({ value: c.id, label: c.name }))} />
                <SelectField label="Subject" placeholder={classId ? 'Choose subject' : 'Pick a class first'} disabled={!classId} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} options={subjectOptions} />
                <Button loading={saving} disabled={!teacherId || !classId || !subjectId} onClick={() => void add()} className="h-11"><Plus className="h-4 w-4" aria-hidden /> Assign</Button>
              </div>
            </Card>

            {data.assignments.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No assignments yet" description="Use the form above to give a teacher a class and subject." />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3 text-right">Remove</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...data.assignments].sort((a, b) => (teacherName.get(a.teacher_id) ?? '').localeCompare(teacherName.get(b.teacher_id) ?? '')).map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{teacherName.get(a.teacher_id) ?? 'Deactivated teacher'}</td>
                        <td className="px-4 py-3">{className.get(a.class_id)}</td>
                        <td className="px-4 py-3">{subjectName.get(a.subject_id)}</td>
                        <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" aria-label="Remove assignment" onClick={() => setRemoving(a)}><Trash2 className="h-4 w-4 text-red-600" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      <ConfirmDialog open={!!removing} title="Remove this assignment?" confirmLabel="Remove" loading={saving}
        message="The teacher will lose access to this class and subject. Lessons they already wrote are kept but they can no longer edit them."
        onConfirm={() => void confirmRemove()} onCancel={() => setRemoving(null)} />
    </>
  );
}
