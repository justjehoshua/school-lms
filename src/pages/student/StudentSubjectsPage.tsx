import { Library } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { SubjectCard } from '@/features/student/SubjectCard';
import { loadStudentData } from '@/features/student/studentData';
import { useAsyncData } from '@/hooks/useAsyncData';

export default function StudentSubjectsPage() {
  const { data, loading, error, reload } = useAsyncData(loadStudentData);
  return (
    <>
      <PageHeader title="Subjects" description="Open a subject to see its lessons." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.subjects.length === 0 ? <EmptyState icon={Library} title="No subjects yet" description="Subjects appear once your administrator assigns them to your class." />
        : data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.subjects.map((s) => <SubjectCard key={s.id} subject={s} data={data} />)}</div>}
    </>
  );
}
