import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { SubjectCard } from '@/features/student/SubjectCard';
import { LessonRow } from '@/features/student/LessonRow';
import { StatusBadge } from '@/features/student/StatusBadge';
import { availableLessonIds, isUpcoming, learnStatus, loadStudentData } from '@/features/student/studentData';
import { useAuth } from '@/features/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatDate } from '@/utils/format';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsyncData(loadStudentData);

  const header = (
    <PageHeader title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`}
      description={data?.className ? `${data.className}${data.session ? ` · ${data.session.name}` : ''}${data.term ? ` · ${data.term.name}` : ''}` : 'Your learning dashboard'} />
  );
  if (loading && !data) return <>{header}<div className="flex justify-center py-16"><Spinner /></div></>;
  if (error) return <>{header}<ErrorState message={error} onRetry={() => void reload()} /></>;
  if (!data) return null;
  if (!data.classId) return <>{header}<EmptyState icon={GraduationCap} title="You have not been placed in a class yet" description="Ask your school administrator to add you to your class. Your subjects will appear here." /></>;

  const ids = availableLessonIds(data);
  const upcoming = data.topics.filter((t) => isUpcoming(t, ids)).sort((a, b) => (a.expected_date ?? '9999').localeCompare(b.expected_date ?? '9999')).slice(0, 5);
  const progressRows = [...data.progress.values()].filter((p) => ids.has(p.lesson_id));
  const completed = progressRows.filter((p) => p.completed);
  const byOpened = (a: { last_opened_at: string }, b: { last_opened_at: string }) => b.last_opened_at.localeCompare(a.last_opened_at);
  const resume = progressRows.filter((p) => !p.completed).sort(byOpened)[0];
  const resumeLesson = resume && data.lessons.find((l) => l.id === resume.lesson_id);
  const recent = progressRows.sort(byOpened).slice(0, 4).map((p) => data.lessons.find((l) => l.id === p.lesson_id)).filter((l): l is NonNullable<typeof l> => !!l);
  const notDone = data.lessons.filter((l) => !data.progress.get(l.id)?.completed).slice(0, 5);
  const pct = data.lessons.length ? Math.round((completed.length / data.lessons.length) * 100) : 0;

  return (
    <div className="space-y-8">
      {header}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          {resumeLesson ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Continue learning</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{resumeLesson.title}</h2>
                <p className="text-sm text-slate-500">{data.subjects.find((s) => s.id === resumeLesson.subject_id)?.name} · picks up at slide {(resume?.last_slide_position ?? 0) + 1}</p></div>
              <Link to={`/student/lessons/${resumeLesson.id}`}><Button size="lg"><PlayCircle className="h-5 w-5" aria-hidden /> Resume</Button></Link>
            </div>
          ) : (
            <div><p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Ready when you are</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{data.lessons.length ? 'Pick a lesson to begin' : 'No lessons released yet'}</h2>
              <p className="text-sm text-slate-500">{data.lessons.length ? 'Your available lessons are listed below.' : 'Your teachers will release lessons here soon. Check the upcoming topics to see what is planned.'}</p></div>
          )}
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="rounded-lg bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-6 w-6" aria-hidden /></span>
          <div className="flex-1"><p className="text-2xl font-bold text-slate-900">{completed.length}<span className="text-base font-medium text-slate-500"> of {data.lessons.length} completed</span></p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Overall progress"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div></div>
        </Card>
      </div>

      <section aria-labelledby="subjects-h">
        <div className="mb-3 flex items-center justify-between"><h2 id="subjects-h" className="text-lg font-semibold text-slate-900">My subjects</h2><Link to="/student/subjects" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link></div>
        {data.subjects.length === 0 ? <EmptyState icon={BookOpen} title="No subjects yet" description="Subjects will appear once your administrator assigns them to your class." />
          : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.subjects.map((s) => <SubjectCard key={s.id} subject={s} data={data} />)}</div>}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><h2 className="font-semibold text-slate-900">Available lessons</h2>
          {notDone.length === 0 ? <p className="mt-3 text-sm text-slate-500">{data.lessons.length ? 'You have completed every available lesson. Well done!' : 'No lessons have been released yet.'}</p>
            : <ul className="mt-1 divide-y divide-slate-100">{notDone.map((l) => <LessonRow key={l.id} lesson={l} data={data} />)}</ul>}</Card>
        <Card className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Upcoming topics</h2><Link to="/student/upcoming" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link></div>
          {upcoming.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing planned yet.</p> : (
            <ul className="mt-1 divide-y divide-slate-100">{upcoming.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><span className="font-medium text-slate-900">{t.title}</span><br /><span className="text-slate-500">{data.subjects.find((s) => s.id === t.subject_id)?.name}</span></span>
                <span className="flex items-center gap-2 text-slate-500">{t.expected_date ? formatDate(t.expected_date) : 'Date to be set'}<StatusBadge status="coming_soon" /></span></li>))}</ul>)}</Card>
        <Card className="p-5"><h2 className="font-semibold text-slate-900">Recently opened</h2>
          {recent.length === 0 ? <p className="mt-3 text-sm text-slate-500">Lessons you open will show up here.</p> : <ul className="mt-1 divide-y divide-slate-100">{recent.map((l) => <LessonRow key={l.id} lesson={l} data={data} />)}</ul>}</Card>
        <Card className="p-5"><h2 className="font-semibold text-slate-900">Completed lessons <Badge tone="green">{completed.length}</Badge></h2>
          {completed.length === 0 ? <p className="mt-3 text-sm text-slate-500">Finish a lesson and it will be listed here.</p> : (
            <ul className="mt-1 divide-y divide-slate-100">{completed.sort(byOpened).slice(0, 4).map((p) => data.lessons.find((l) => l.id === p.lesson_id)).filter((l): l is NonNullable<typeof l> => !!l).map((l) => <LessonRow key={l.id} lesson={l} data={data} />)}</ul>)}</Card>
      </div>
    </div>
  );
}
