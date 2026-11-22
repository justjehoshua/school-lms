import { Link } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { StatusBadge, type DisplayStatus } from './StatusBadge';
import { availableLessonIds, currentTopic, isUpcoming, type StudentData } from './studentData';
import { subjectIcon } from '@/utils/subjectIcons';
import type { Subject } from '@/services/adminService';

export function SubjectCard({ subject, data }: { subject: Subject; data: StudentData }) {
  const Icon = subjectIcon(subject.icon);
  const lessons = data.lessons.filter((l) => l.subject_id === subject.id);
  const done = lessons.filter((l) => data.progress.get(l.id)?.completed).length;
  const started = lessons.some((l) => data.progress.has(l.id));
  const ids = availableLessonIds(data);
  const upcoming = data.topics.filter((t) => t.subject_id === subject.id && isUpcoming(t, ids)).length;
  const topic = currentTopic(subject.id, data);
  const status: DisplayStatus = lessons.length === 0 ? 'coming_soon' : done === lessons.length ? 'completed' : started ? 'in_progress' : 'available';
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <Link to={`/student/lessons?subject=${subject.id}`} className="block rounded-xl focus-visible:ring-offset-2">
      <Card className="h-full p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-lg bg-brand-50 p-2.5 text-brand-700"><Icon className="h-6 w-6" aria-hidden /></span>
          <StatusBadge status={status} />
        </div>
        <h3 className="mt-3 text-lg font-semibold text-slate-900">{subject.name}</h3>
        <p className="mt-1 truncate text-sm text-slate-500">{topic ? `Current topic: ${topic.title}` : 'No current topic yet'}</p>
        <div className="mt-4 h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${subject.name} progress`}>
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-sm text-slate-600">
          <span>{lessons.length} lesson{lessons.length === 1 ? '' : 's'} available</span>
          <span>{upcoming} upcoming</span>
        </div>
      </Card>
    </Link>
  );
}
