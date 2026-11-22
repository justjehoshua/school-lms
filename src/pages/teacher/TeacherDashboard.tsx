import { Link } from 'react-router-dom';
import { BookText, CalendarClock, CheckCircle2, FilePen, Library, Plus, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/features/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadTeacherContext } from '@/features/schemes/useTeacherContext';
import { listRecentLessons, listUpcomingTopics, loadTeacherCounts } from '@/services/teacherService';
import { formatDate } from '@/utils/format';

async function load() {
  const [ctx, counts, recent, upcoming] = await Promise.all([loadTeacherContext(), loadTeacherCounts(), listRecentLessons(5), listUpcomingTopics(5)]);
  return { ctx, counts, recent, upcoming };
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="rounded-lg bg-brand-50 p-3 text-brand-700"><Icon className="h-5 w-5" aria-hidden /></span>
      <div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
    </Card>
  );
}

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsyncData(load);
  return (
    <>
      <PageHeader title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`} description="Your lessons, schemes of work and upcoming topics."
        actions={<Link to="/teacher/lessons/new"><Button><Plus className="h-4 w-4" aria-hidden /> New lesson</Button></Link>} />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Assigned subjects" value={new Set(data.ctx.assignments.map((a) => a.subject_id)).size} icon={Library} />
              <Stat label="Total lessons" value={data.counts.total} icon={BookText} />
              <Stat label="Published" value={data.counts.published} icon={CheckCircle2} />
              <Stat label="Drafts" value={data.counts.drafts} icon={FilePen} />
              <Stat label="Upcoming topics" value={data.upcoming.length} icon={CalendarClock} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="font-semibold text-slate-900">Recent lessons</h2>
                {data.recent.length === 0 ? <p className="mt-3 text-sm text-slate-500">No lessons yet. They will appear here once you create one.</p> : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.recent.map((l) => (
                      <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span><span className="font-medium text-slate-900">{l.title}</span><br /><span className="text-slate-500">{data.ctx.className.get(l.class_id)} · {data.ctx.subjectName.get(l.subject_id)}</span></span>
                        <Badge tone={l.status === 'published' ? 'green' : l.status === 'scheduled' ? 'amber' : 'gray'}>{l.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Upcoming schedule</h2>
                  <Link to="/teacher/upcoming" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link></div>
                {data.upcoming.length === 0 ? <p className="mt-3 text-sm text-slate-500">No upcoming topics. Plan them in a <Link className="font-semibold text-brand-700 hover:underline" to="/teacher/schemes">scheme of work</Link>.</p> : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {data.upcoming.map((t) => (
                      <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span><span className="font-medium text-slate-900">{t.title}</span><br /><span className="text-slate-500">{data.ctx.className.get(t.class_id)} · {data.ctx.subjectName.get(t.subject_id)}</span></span>
                        <span className="text-slate-500">{t.expected_date ? formatDate(t.expected_date) : 'No date'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
    </>
  );
}
