import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { LessonRow } from '@/features/student/LessonRow';
import { learnStatus, loadStudentData, type LearnStatus } from '@/features/student/studentData';
import { useAsyncData } from '@/hooks/useAsyncData';

export default function StudentLessonsPage() {
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useAsyncData(loadStudentData);
  const [subjectId, setSubjectId] = useState(params.get('subject') ?? '');
  const [status, setStatus] = useState<'' | LearnStatus>('');

  const lessons = (data?.lessons ?? []).filter((l) => (!subjectId || l.subject_id === subjectId) && (!status || learnStatus(data?.progress.get(l.id)) === status));
  return (
    <>
      <PageHeader title="Lessons" description="Every lesson your teachers have released to you." />
      <div className="mb-4 flex flex-wrap gap-3">
        <select aria-label="Filter by subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">All subjects</option>{data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as '' | LearnStatus)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Any status</option><option value="available">Available</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
        </select>
      </div>
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && lessons.length === 0 ? <EmptyState icon={BookOpen} title={data.lessons.length ? 'No lessons match your filters' : 'No lessons released yet'} description={data.lessons.length ? 'Try a different subject or status.' : 'Your teachers will release lessons soon. Check Upcoming Topics to see what is planned.'} />
        : data && <Card className="px-5"><ul className="divide-y divide-slate-100">{lessons.map((l) => <LessonRow key={l.id} lesson={l} data={data} />)}</ul></Card>}
    </>
  );
}
