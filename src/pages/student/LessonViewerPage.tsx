import { useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Lock } from 'lucide-react';
import { SlidePlayer } from '@/components/slides/SlidePlayer';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAuth } from '@/features/auth/AuthContext';
import type { SlideDraft } from '@/features/slide-editor/types';
import { getLesson, type Lesson } from '@/services/lessonService';
import { listSlides } from '@/services/slideService';
import { listSubjects } from '@/services/adminService';
import { getMyProgress, getTeacherName, markLessonComplete, saveSlidePosition, touchLesson, type ProgressRow } from '@/services/progressService';

interface Loaded { lesson: Lesson; slides: SlideDraft[]; progress: ProgressRow | null; subjectName: string; teacherName: string }

function Viewer({ data }: { data: Loaded }) {
  const { lesson, slides, progress } = data;
  const { profile } = useAuth();
  const navigate = useNavigate();
  const completed = useRef(!!progress?.completed);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<number | null>(null);
  const warned = useRef(false);
  const schoolId = profile!.school_id;
  const studentId = profile!.id;
  const start = progress && !progress.completed ? Math.min(progress.last_slide_position, Math.max(0, slides.length - 1)) : 0;

  const warnOnce = useCallback(() => {
    if (warned.current) return;
    warned.current = true;
    toast.error('Your progress could not be saved. Check your connection.');
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pending.current === null) return;
    const position = pending.current;
    pending.current = null;
    saveSlidePosition(schoolId, studentId, lesson.id, position).catch(warnOnce);
  }, [schoolId, studentId, lesson.id, warnOnce]);

  useEffect(() => {
    touchLesson(schoolId, studentId, lesson.id).catch(warnOnce);
    if (start > 0) toast(`Continuing from slide ${start + 1}`, { icon: '▶️' });
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
    // run once per lesson
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const onIndexChange = useCallback((i: number) => {
    pending.current = i;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 600);
  }, [flush]);

  const onComplete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    markLessonComplete(schoolId, studentId, lesson.id)
      .then(() => toast.success('Lesson completed. Well done!'))
      .catch(() => { completed.current = false; toast.error('Could not record your completion. Go back one slide and forward again to retry.'); });
  }, [schoolId, studentId, lesson.id]);

  return (
    <div className="-m-4 h-[calc(100vh-4rem)] lg:-m-8">
      <SlidePlayer slides={slides} heading={lesson.title}
        subheading={`${data.subjectName} · ${data.teacherName}${lesson.topic ? ` · ${lesson.topic}` : ''}`}
        initialIndex={start} onIndexChange={onIndexChange} onComplete={onComplete} onExit={() => navigate('/student/lessons')} />
    </div>
  );
}

export default function LessonViewerPage() {
  const { id } = useParams();
  const load = useCallback(async (): Promise<Loaded | null> => {
    if (!id) return null;
    const lesson = await getLesson(id); // the database returns nothing unless this lesson is released to this student
    if (!lesson) return null;
    const [slides, progress, subjects, teacherName] = await Promise.all([listSlides(id), getMyProgress(id), listSubjects(), getTeacherName(lesson.teacher_id)]);
    return { lesson, slides, progress, subjectName: subjects.find((s) => s.id === lesson.subject_id)?.name ?? 'Subject', teacherName };
  }, [id]);
  const { data, loading, error, reload } = useAsyncData(load);

  if (loading && !data) return <div className="flex justify-center py-16"><Spinner label="Opening lesson" /></div>;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data) return <EmptyState icon={Lock} title="This lesson is not available" description="It may not have been released yet, or it may have closed. Check Upcoming Topics to see when it is planned." action={<Link to="/student/lessons"><Button>Back to lessons</Button></Link>} />;
  return <Viewer key={data.lesson.id} data={data} />;
}
