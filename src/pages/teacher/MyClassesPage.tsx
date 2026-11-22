import { Link } from 'react-router-dom';
import { School } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadTeacherContext, type TeacherContext } from '@/features/schemes/useTeacherContext';
import { countStudentsByClass } from '@/services/teacherService';

interface Bundle { ctx: TeacherContext; students: Record<string, number> }
async function load(): Promise<Bundle> {
  const ctx = await loadTeacherContext();
  const students = ctx.currentSession ? await countStudentsByClass(ctx.currentSession.id) : {};
  return { ctx, students };
}

export default function MyClassesPage() {
  const { data, loading, error, reload } = useAsyncData(load);
  const classIds = data ? [...new Set(data.ctx.assignments.map((a) => a.class_id))] : [];
  return (
    <>
      <PageHeader title="My Classes" description="The classes you have been assigned to teach." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && classIds.length === 0 ? (
          <EmptyState icon={School} title="No classes assigned yet" description="Ask your school administrator to assign you to a class and subject." />
        ) : data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {classIds.map((cid) => {
              const mine = data.ctx.assignments.filter((a) => a.class_id === cid);
              return (
                <Card key={cid} className="p-5">
                  <h2 className="text-lg font-semibold text-slate-900">{data.ctx.className.get(cid)}</h2>
                  <p className="mt-1 text-sm text-slate-500">{data.students[cid] ?? 0} student{(data.students[cid] ?? 0) === 1 ? '' : 's'}{data.ctx.currentSession ? ` · ${data.ctx.currentSession.name}` : ''}</p>
                  <div className="mt-4 space-y-2">
                    {mine.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <Badge tone="blue">{data.ctx.subjectName.get(a.subject_id)}</Badge>
                        <Link className="text-sm font-semibold text-brand-700 hover:underline" to={`/teacher/schemes?class=${cid}&subject=${a.subject_id}`}>Scheme of work</Link>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </>
  );
}
