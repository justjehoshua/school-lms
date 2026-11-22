import { CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { StatusBadge } from '@/features/student/StatusBadge';
import { availableLessonIds, isUpcoming, loadStudentData } from '@/features/student/studentData';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatDate } from '@/utils/format';

export default function StudentUpcomingPage() {
  const { data, loading, error, reload } = useAsyncData(loadStudentData);
  const ids = data ? availableLessonIds(data) : new Set<string>();
  const topics = (data?.topics ?? []).filter((t) => isUpcoming(t, ids)).sort((a, b) => (a.expected_date ?? '9999').localeCompare(b.expected_date ?? '9999'));
  return (
    <>
      <PageHeader title="Upcoming Topics" description="What your class will learn next. The lessons open when your teacher releases them." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && topics.length === 0 ? <EmptyState icon={CalendarClock} title="Nothing coming up yet" description="When your teachers plan new topics, you will see them here." />
        : data && (
          <Card className="divide-y divide-slate-100">{topics.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div><p className="font-medium text-slate-900">Week {t.week_number}: {t.title}</p><p className="text-sm text-slate-500">{data.subjects.find((s) => s.id === t.subject_id)?.name}</p></div>
              <div className="flex items-center gap-3 text-sm text-slate-500">{t.expected_date ? formatDate(t.expected_date) : 'Date to be set'}<StatusBadge status="coming_soon" /></div>
            </div>))}</Card>
        )}
    </>
  );
}
