import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { StatusBadge } from '@/features/student/StatusBadge';
import { availableLessonIds, loadStudentData } from '@/features/student/studentData';
import { useAsyncData } from '@/hooks/useAsyncData';
import { formatDate } from '@/utils/format';

export default function StudentSchemePage() {
  const { data, loading, error, reload } = useAsyncData(loadStudentData);
  const [subjectPick, setSubjectPick] = useState('');
  const [termPick, setTermPick] = useState('');
  const subjectId = subjectPick || data?.subjects[0]?.id || '';
  const termId = termPick || data?.term?.id || '';
  const ids = data ? availableLessonIds(data) : new Set<string>();
  const topics = (data?.topics ?? []).filter((t) => t.subject_id === subjectId && t.term_id === termId).sort((a, b) => a.week_number - b.week_number);

  return (
    <>
      <PageHeader title="Scheme of Work" description="The topics your class will cover. A lesson opens once your teacher releases it." />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.subjects.length === 0 ? <EmptyState icon={ClipboardList} title="No subjects yet" description="Your scheme of work will appear once subjects are assigned to your class." />
        : data && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <select aria-label="Subject" value={subjectId} onChange={(e) => setSubjectPick(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select aria-label="Term" value={termId} onChange={(e) => setTermPick(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                {data.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            {topics.length === 0 ? <EmptyState icon={ClipboardList} title="No topics planned yet" description="Your teacher has not added a scheme of work for this subject and term." /> : (
              <Card className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Week</th><th className="px-4 py-3">Topic</th><th className="hidden px-4 py-3 md:table-cell">Objectives</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Lesson</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{topics.map((t) => {
                  const open = !!t.lesson_id && ids.has(t.lesson_id);
                  return (<tr key={t.id} className="align-top"><td className="px-4 py-3 font-semibold">{t.week_number}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-900">{t.title}</p>{t.description && <p className="mt-0.5 max-w-xs text-slate-500">{t.description}</p>}</td>
                    <td className="hidden max-w-xs px-4 py-3 text-slate-500 md:table-cell">{t.objectives ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{t.expected_date ? formatDate(t.expected_date) : '—'}</td>
                    <td className="px-4 py-3">{open ? <Link className="font-semibold text-brand-700 hover:underline" to={`/student/lessons/${t.lesson_id}`}>Open lesson</Link> : <StatusBadge status={t.status === 'completed' ? 'completed' : 'coming_soon'} />}</td></tr>);
                })}</tbody></table></Card>
            )}
          </div>
        )}
    </>
  );
}
