import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, BookText, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import { loadTeacherContext } from '@/features/schemes/useTeacherContext';
import { archiveLesson, deleteLesson, duplicateLesson, listLessons, restoreLesson, type Lesson, type LessonFilters } from '@/services/lessonService';
import { STATUS_LABEL, STATUS_TONE, type LessonStatus } from '@/utils/lessonStatus';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';

const PAGE_SIZE = 10;

export default function LessonsPage({ fixedStatus, title = 'Lesson Notes', rowTarget = 'details' }: { fixedStatus?: LessonStatus; title?: string; rowTarget?: 'details' | 'slides' }) {
  const target = (id: string) => (rowTarget === 'slides' ? `/teacher/lessons/${id}/slides` : `/teacher/lessons/${id}`);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const ctxState = useAsyncData(loadTeacherContext);
  const ctx = ctxState.data;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | LessonStatus>(fixedStatus ?? '');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300); return () => clearTimeout(t); }, [searchInput]);

  const load = useCallback(() => {
    const f: LessonFilters = { search, status: fixedStatus ?? status, classId, subjectId, page, pageSize: PAGE_SIZE };
    return listLessons(f);
  }, [search, status, fixedStatus, classId, subjectId, page]);
  const { data, loading, error, reload } = useAsyncData(load);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const classOptions = ctx ? [...new Set(ctx.assignments.map((a) => a.class_id))] : [];
  const subjectOptions = ctx ? [...new Set(ctx.assignments.filter((a) => !classId || a.class_id === classId).map((a) => a.subject_id))] : [];
  const filtersActive = !!(search || classId || subjectId || (!fixedStatus && status));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={title} description="Create, organise and publish your lesson notes."
        actions={<Link to="/teacher/lessons/new"><Button><Plus className="h-4 w-4" aria-hidden /> New lesson</Button></Link>} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input type="search" aria-label="Search lessons" placeholder="Search by title" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" />
        </div>
        <select aria-label="Filter by class" value={classId} onChange={(e) => { setClassId(e.target.value); setSubjectId(''); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">All classes</option>
          {classOptions.map((id) => <option key={id} value={id}>{ctx?.className.get(id)}</option>)}
        </select>
        <select aria-label="Filter by subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">All subjects</option>
          {subjectOptions.map((id) => <option key={id} value={id}>{ctx?.subjectName.get(id)}</option>)}
        </select>
        {!fixedStatus && (
          <select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as '' | LessonStatus); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Active lessons</option>
            {(Object.keys(STATUS_LABEL) as LessonStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        )}
      </div>

      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && data.rows.length === 0 ? (
          <EmptyState icon={BookText} title={filtersActive ? 'No lessons match your filters' : 'No lessons yet'}
            description={filtersActive ? 'Try clearing the search or filters.' : 'Create your first lesson note to get started.'}
            action={!filtersActive ? <Link to="/teacher/lessons/new"><Button><Plus className="h-4 w-4" aria-hidden /> New lesson</Button></Link> : undefined} />
        ) : data && (
          <>
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Lesson</th><th className="hidden px-4 py-3 md:table-cell">Class · Subject</th><th className="hidden px-4 py-3 sm:table-cell">Week</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 lg:table-cell">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((l) => (
                    <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(target(l.id))}>
                      <td className="px-4 py-3"><Link to={target(l.id)} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:text-brand-700">{l.title}</Link>{l.topic && <p className="text-slate-500">{l.topic}</p>}</td>
                      <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{ctx?.className.get(l.class_id)} · {ctx?.subjectName.get(l.subject_id)}</td>
                      <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{l.week_number ?? '—'}</td>
                      <td className="px-4 py-3"><Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge></td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 lg:table-cell">{formatDateTime(l.updated_at)}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="sm" aria-label={`Edit ${l.title}`} onClick={() => navigate(target(l.id))}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" aria-label={`Duplicate ${l.title}`} disabled={busy} onClick={() => void act(() => duplicateLesson(l, profile!.id), 'Lesson duplicated as a draft')}><Copy className="h-4 w-4" /></Button>
                        {l.status === 'archived'
                          ? <Button variant="ghost" size="sm" aria-label={`Restore ${l.title}`} disabled={busy} onClick={() => void act(() => restoreLesson(l.id), 'Restored to drafts')}><ArchiveRestore className="h-4 w-4" /></Button>
                          : <Button variant="ghost" size="sm" aria-label={`Archive ${l.title}`} disabled={busy} onClick={() => void act(() => archiveLesson(l.id), 'Lesson archived')}><Archive className="h-4 w-4" /></Button>}
                        <Button variant="ghost" size="sm" aria-label={`Delete ${l.title}`} onClick={() => setDeleting(l)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>{data.total} lesson{data.total === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}

      <ConfirmDialog open={!!deleting} title="Delete this lesson?" loading={busy}
        message={`"${deleting?.title}" and all of its slides will be permanently deleted, and students lose access. To keep it, archive it instead.`}
        onConfirm={() => { const d = deleting; if (d) void act(() => deleteLesson(d.id), 'Lesson deleted').then(() => setDeleting(null)); }} onCancel={() => setDeleting(null)} />
    </>
  );
}
