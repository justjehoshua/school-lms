import { Link } from 'react-router-dom';
import { StatusBadge } from './StatusBadge';
import { learnStatus, type StudentData, type StudentLesson } from './studentData';

export function LessonRow({ lesson, data }: { lesson: StudentLesson; data: StudentData }) {
  const subject = data.subjects.find((s) => s.id === lesson.subject_id)?.name;
  const status = learnStatus(data.progress.get(lesson.id));
  const action = status === 'completed' ? 'Review' : status === 'in_progress' ? 'Resume' : 'Start';
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{lesson.title}</p>
        <p className="truncate text-sm text-slate-500">{subject}{lesson.week_number ? ` · Week ${lesson.week_number}` : ''}{lesson.topic ? ` · ${lesson.topic}` : ''} · {data.teachers.get(lesson.teacher_id) ?? 'Teacher'}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />
        <Link to={`/student/lessons/${lesson.id}`} className="text-sm font-semibold text-brand-700 hover:underline">{action}</Link>
      </div>
    </li>
  );
}
