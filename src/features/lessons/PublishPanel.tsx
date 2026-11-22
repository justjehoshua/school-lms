import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle, Archive, ArchiveRestore, CalendarClock, EyeOff, Send, Trash2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TextField } from '@/components/forms/TextField';
import { archiveLesson, deleteLesson, releaseLesson, restoreLesson, unpublishLesson, type Lesson } from '@/services/lessonService';
import { STATUS_LABEL, STATUS_TONE } from '@/utils/lessonStatus';
import { formatDateTime, toLocalInput } from '@/utils/format';
import { friendlyError } from '@/lib/errors';

type Mode = 'publish' | 'schedule';

function ReleaseForm({ mode, lesson, slideCount, onDone, onCancel }: { mode: Mode; lesson: Lesson; slideCount: number; onDone: () => void; onCancel: () => void }) {
  const [publishAt, setPublishAt] = useState(toLocalInput(lesson.publish_at));
  const [until, setUntil] = useState(toLocalInput(lesson.available_until));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (slideCount === 0) return setError('Add at least one slide before publishing or scheduling this lesson.');
    const start = publishAt ? new Date(publishAt) : null;
    const end = until ? new Date(until) : null;
    if (mode === 'schedule') {
      if (!start) return setError('Choose when the lesson should open.');
      if (start.getTime() <= Date.now()) return setError('The opening time must be in the future.');
    }
    if (end && end.getTime() <= (mode === 'schedule' && start ? start.getTime() : Date.now())) return setError('The closing time must be after the opening time.');
    setSaving(true);
    try {
      await releaseLesson(lesson.id, mode, mode === 'schedule' && start ? start.toISOString() : null, end ? end.toISOString() : null);
      toast.success(mode === 'publish' ? 'Lesson published' : 'Lesson scheduled');
      onDone();
    } catch (e) { setError(friendlyError(e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {mode === 'schedule' && <TextField label="Opens for students at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} hint="Students are blocked until this time. The server enforces it." />}
      <TextField label="Closes at (optional)" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} hint="Leave empty to keep the lesson available." />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={saving} onClick={() => void submit()}>{mode === 'publish' ? 'Publish now' : 'Schedule'}</Button>
      </div>
    </div>
  );
}

export function PublishPanel({ lesson, slideCount, onChanged }: { lesson: Lesson; slideCount: number; onChanged: () => void }) {
  const navigate = useNavigate();
  const [modal, setModal] = useState<Mode | null>(null);
  const [confirm, setConfirm] = useState<'unpublish' | 'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string, after?: () => void) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setConfirm(null); if (after) after(); else onChanged(); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const s = lesson.status;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Publishing</h2>
        <Badge tone={STATUS_TONE[s]}>{STATUS_LABEL[s]}</Badge>
      </div>

      <div className="mt-3 space-y-1 text-sm text-slate-600">
        {s === 'scheduled' && lesson.publish_at && <p>Opens {formatDateTime(lesson.publish_at)}</p>}
        {s === 'published' && <p>Visible to students now{lesson.published_at ? ` (since ${formatDateTime(lesson.published_at)})` : ''}.</p>}
        {lesson.available_until && <p>Closes {formatDateTime(lesson.available_until)}</p>}
        {s === 'draft' && <p>Only you can see this lesson.</p>}
        {s === 'archived' && <p>Hidden from students. Restore it to edit again.</p>}
      </div>

      {slideCount === 0 && (s === 'draft' || s === 'scheduled') && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />This lesson has no slides yet. Add slides before you publish or schedule it.</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {(s === 'draft' || s === 'scheduled') && <Button onClick={() => setModal('publish')}><Send className="h-4 w-4" aria-hidden /> Publish now</Button>}
        {(s === 'draft' || s === 'scheduled') && <Button variant="secondary" onClick={() => setModal('schedule')}><CalendarClock className="h-4 w-4" aria-hidden /> {s === 'scheduled' ? 'Reschedule' : 'Schedule for later'}</Button>}
        {s === 'scheduled' && <Button variant="secondary" disabled={busy} onClick={() => void run(() => unpublishLesson(lesson.id), 'Schedule cancelled')}>Cancel schedule</Button>}
        {s === 'published' && <Button variant="secondary" onClick={() => setConfirm('unpublish')}><EyeOff className="h-4 w-4" aria-hidden /> Unpublish</Button>}
        {s === 'published' && <Button variant="ghost" onClick={() => setModal('publish')}>Change closing time</Button>}
        {s === 'archived'
          ? <Button variant="secondary" disabled={busy} onClick={() => void run(() => restoreLesson(lesson.id), 'Restored to drafts')}><ArchiveRestore className="h-4 w-4" aria-hidden /> Restore to drafts</Button>
          : <Button variant="ghost" onClick={() => setConfirm('archive')}><Archive className="h-4 w-4" aria-hidden /> Archive</Button>}
        <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirm('delete')}><Trash2 className="h-4 w-4" aria-hidden /> Delete lesson</Button>
      </div>

      <Modal open={modal !== null} title={modal === 'schedule' ? 'Schedule lesson' : s === 'published' ? 'Change closing time' : 'Publish lesson'} onClose={() => setModal(null)}>
        {modal && <ReleaseForm mode={modal} lesson={lesson} slideCount={slideCount} onCancel={() => setModal(null)} onDone={() => { setModal(null); onChanged(); }} />}
      </Modal>
      <ConfirmDialog open={confirm === 'unpublish'} title="Unpublish this lesson?" confirmLabel="Unpublish" loading={busy}
        message="Students will immediately lose access. Their progress is kept." onConfirm={() => void run(() => unpublishLesson(lesson.id), 'Lesson unpublished')} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'archive'} title="Archive this lesson?" confirmLabel="Archive" loading={busy}
        message="It will be hidden from students and from your active list. You can restore it later." onConfirm={() => void run(() => archiveLesson(lesson.id), 'Lesson archived')} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'delete'} title="Delete this lesson?" loading={busy}
        message="The lesson and all of its slides will be permanently deleted. To keep it, archive it instead."
        onConfirm={() => void run(() => deleteLesson(lesson.id), 'Lesson deleted', () => navigate('/teacher/lessons', { replace: true }))} onCancel={() => setConfirm(null)} />
    </Card>
  );
}
