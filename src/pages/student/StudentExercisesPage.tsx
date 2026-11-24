import { Link } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { listStudentExercises } from '@/services/exerciseService';
import { listSubjects } from '@/services/adminService';
import { listLessonTitles } from '@/pages/student/lessonTitles';

async function load() {
  const [ex, subjects, lessons] = await Promise.all([listStudentExercises(), listSubjects(), listLessonTitles()]);
  return { ...ex, subjects, lessons };
}

export default function StudentExercisesPage() {
  const { data, loading, error, reload } = useAsyncData(load);
  return (
    <>
      <PageHeader title="Exercises" description="Practice questions from your lessons." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.exercises.length === 0 ? <EmptyState icon={ListChecks} title="No exercises yet" description="When a teacher publishes an exercise for one of your lessons, it will appear here." />
        : data && (
          <Card className="divide-y divide-slate-100">{data.exercises.map((e) => {
            const sub = data.submissions.get(e.id);
            const res = sub ? data.results.get(sub.id) : undefined;
            const lesson = data.lessons.get(e.lesson_id);
            const subject = data.subjects.find((s) => s.id === lesson?.subject_id)?.name;
            return (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div><p className="font-medium text-slate-900">{e.title}</p><p className="text-sm text-slate-500">{lesson?.title}{subject ? ` · ${subject}` : ''}</p></div>
                <div className="flex items-center gap-3">
                  {!sub ? <Badge tone="blue">Not started</Badge> : res ? <Badge tone="green">Score {res.score} / {res.max_score}</Badge> : <Badge tone="amber">Submitted, awaiting feedback</Badge>}
                  <Link to={`/student/exercises/${e.id}`} className="text-sm font-semibold text-brand-700 hover:underline">{!sub ? 'Start' : 'Open'}</Link>
                </div>
              </div>);
          })}</Card>
        )}
    </>
  );
}
