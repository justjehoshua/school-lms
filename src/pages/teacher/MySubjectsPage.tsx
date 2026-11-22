import { Link } from 'react-router-dom';
import { Library } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadTeacherContext } from '@/features/schemes/useTeacherContext';
import { subjectIcon } from '@/utils/subjectIcons';

export default function MySubjectsPage() {
  const { data, loading, error, reload } = useAsyncData(loadTeacherContext);
  const subjectIds = data ? [...new Set(data.assignments.map((a) => a.subject_id))] : [];
  return (
    <>
      <PageHeader title="My Subjects" description="The subjects you teach, and the classes you teach them to." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && subjectIds.length === 0 ? (
          <EmptyState icon={Library} title="No subjects assigned yet" description="Ask your school administrator to assign you to a class and subject." />
        ) : data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {subjectIds.map((sid) => {
              const subject = data.subjects.find((s) => s.id === sid);
              const Icon = subjectIcon(subject?.icon ?? null);
              return (
                <Card key={sid} className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-brand-50 p-2.5 text-brand-700"><Icon className="h-5 w-5" aria-hidden /></span>
                    <h2 className="text-lg font-semibold text-slate-900">{subject?.name}</h2>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {data.assignments.filter((a) => a.subject_id === sid).map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{data.className.get(a.class_id)}</span>
                        <Link className="font-semibold text-brand-700 hover:underline" to={`/teacher/schemes?class=${a.class_id}&subject=${sid}`}>Scheme of work</Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
    </>
  );
}
