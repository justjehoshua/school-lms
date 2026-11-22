import { CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadTeacherContext } from '@/features/schemes/useTeacherContext';
import { listUpcomingTopics } from '@/services/teacherService';
import { formatDate } from '@/utils/format';

async function load() {
  const [ctx, topics] = await Promise.all([loadTeacherContext(), listUpcomingTopics()]);
  return { ctx, topics };
}

export default function UpcomingTopicsPage() {
  const { data, loading, error, reload } = useAsyncData(load);
  return (
    <>
      <PageHeader title="Upcoming Topics" description="Topics from your schemes of work that are planned or in progress, soonest first." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.topics.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nothing planned yet" description="Add topics to a scheme of work and they will appear here." />
        ) : data && (
          <Card className="divide-y divide-slate-100">
            {data.topics.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">Week {t.week_number}: {t.title}</p>
                  <p className="text-sm text-slate-500">{data.ctx.className.get(t.class_id)} · {data.ctx.subjectName.get(t.subject_id)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">{t.expected_date ? formatDate(t.expected_date) : 'No date set'}</span>
                  <Badge tone={t.status === 'in_progress' ? 'amber' : 'gray'}>{t.status === 'in_progress' ? 'In progress' : 'Planned'}</Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
    </>
  );
}
