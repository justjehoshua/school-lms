import { useCallback, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Presentation } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { TextField } from '@/components/forms/TextField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { SelectField } from '@/components/forms/SelectField';
import { PublishPanel } from '@/features/lessons/PublishPanel';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { useAuth } from '@/features/auth/AuthContext';
import { loadTeacherContext, type TeacherContext } from '@/features/schemes/useTeacherContext';
import { countSlides, createLesson, getLesson, linkTopic, linkedTopicId, updateLesson, type Lesson } from '@/services/lessonService';
import { findScheme, listTopics } from '@/services/teacherService';
import { friendlyError } from '@/lib/errors';

const schema = z.object({
  class_id: z.string().min(1, 'Choose a class'),
  subject_id: z.string().min(1, 'Choose a subject'),
  term_id: z.string().min(1, 'Choose a term'),
  week_number: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 30), 'Week must be 1 to 30'),
  scheme_topic_id: z.string(),
  topic: z.string().max(200),
  title: z.string().trim().min(2, 'Enter a lesson title').max(200),
  objectives: z.string().max(2000),
  introduction: z.string().max(5000),
  summary: z.string().max(5000),
});
type Values = z.infer<typeof schema>;

function LessonForm({ ctx, lesson, linked, slideCount, onSaved }: { ctx: TeacherContext; lesson: Lesson | null; linked: string; slideCount: number; onSaved: () => void }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      class_id: lesson?.class_id ?? params.get('class') ?? '', subject_id: lesson?.subject_id ?? params.get('subject') ?? '',
      term_id: lesson?.term_id ?? ctx.currentTerm?.id ?? '', week_number: lesson?.week_number ? String(lesson.week_number) : '',
      scheme_topic_id: linked, topic: lesson?.topic ?? '', title: lesson?.title ?? '', objectives: lesson?.objectives ?? '',
      introduction: lesson?.introduction ?? '', summary: lesson?.summary ?? '',
    },
  });
  useUnsavedWarning(isDirty);

  const classId = watch('class_id'); const subjectId = watch('subject_id'); const termId = watch('term_id');
  const classOptions = [...new Set(ctx.assignments.map((a) => a.class_id))].map((id) => ({ value: id, label: ctx.className.get(id) ?? 'Class' }));
  const subjectOptions = ctx.assignments.filter((a) => a.class_id === classId).map((a) => ({ value: a.subject_id, label: ctx.subjectName.get(a.subject_id) ?? 'Subject' }));
  const termOptions = ctx.terms.map((t) => ({ value: t.id, label: `${ctx.sessions.find((s) => s.id === t.session_id)?.name ?? ''} · ${t.name}` }));

  const loadTopics = useCallback(async () => {
    if (!classId || !subjectId || !termId) return [];
    const schemeId = await findScheme(classId, subjectId, termId);
    return schemeId ? listTopics(schemeId) : [];
  }, [classId, subjectId, termId]);
  const topics = useAsyncData(loadTopics);

  const topicId = watch('scheme_topic_id');
  useEffect(() => {
    const t = topics.data?.find((x) => x.id === topicId);
    if (t && !lesson) { setValue('topic', t.title, { shouldDirty: true }); setValue('week_number', String(t.week_number), { shouldDirty: true }); if (!watch('title')) setValue('title', t.title, { shouldDirty: true }); }
    // only prefill for brand-new lessons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const onSubmit = async (v: Values) => {
    const term = ctx.terms.find((t) => t.id === v.term_id);
    if (!profile || !term) return;
    const input = { class_id: v.class_id, subject_id: v.subject_id, session_id: term.session_id, term_id: v.term_id,
      week_number: v.week_number ? Number(v.week_number) : null, topic: v.topic, title: v.title, objectives: v.objectives, introduction: v.introduction, summary: v.summary };
    try {
      if (lesson) {
        await updateLesson(lesson.id, input);
        await linkTopic(lesson.id, v.scheme_topic_id || null);
        reset(v);
        toast.success('Lesson saved');
        onSaved();
      } else {
        const id = await createLesson(profile.school_id, profile.id, input);
        if (v.scheme_topic_id) await linkTopic(id, v.scheme_topic_id);
        reset(v);
        toast.success('Lesson created as a draft');
        navigate(`/teacher/lessons/${id}`, { replace: true });
      }
    } catch (e) { toast.error(friendlyError(e)); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 lg:col-span-2" noValidate>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Details</h2>
          <TextField label="Lesson title" placeholder="e.g. Adding fractions with unlike denominators" error={errors.title?.message} {...register('title')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Class" placeholder="Choose class" disabled={!!lesson} options={classOptions} error={errors.class_id?.message}
              {...register('class_id', { onChange: () => { setValue('subject_id', ''); setValue('scheme_topic_id', ''); } })} />
            <SelectField label="Subject" placeholder={classId ? 'Choose subject' : 'Pick a class first'} disabled={!!lesson || !classId} options={subjectOptions} error={errors.subject_id?.message}
              {...register('subject_id', { onChange: () => setValue('scheme_topic_id', '') })} />
            <SelectField label="Session and term" placeholder="Choose term" options={termOptions} error={errors.term_id?.message}
              {...register('term_id', { onChange: () => setValue('scheme_topic_id', '') })} />
          </div>
          {lesson && <p className="text-sm text-slate-500">Class and subject cannot be changed after a lesson is created. Duplicate the lesson if you need it for another class.</p>}
          <SelectField label="Link to a topic in your scheme of work (optional)"
            placeholder={topics.data && topics.data.length === 0 ? 'No topics in the scheme for this class, subject and term' : 'No link'}
            options={(topics.data ?? []).map((t) => ({ value: t.id, label: `Week ${t.week_number}: ${t.title}` }))} {...register('scheme_topic_id')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Week" type="number" min={1} max={30} error={errors.week_number?.message} {...register('week_number')} />
            <div className="sm:col-span-2"><TextField label="Topic" error={errors.topic?.message} {...register('topic')} /></div>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-slate-900">Overview</h2>
          <TextAreaField label="Learning objectives" error={errors.objectives?.message} {...register('objectives')} />
          <TextAreaField label="Introduction" error={errors.introduction?.message} {...register('introduction')} />
          <TextAreaField label="Summary" error={errors.summary?.message} {...register('summary')} />
          <p className="text-sm text-slate-500">The full lesson content, examples and exercises are built as slides in the slide editor.</p>
        </Card>
        <div className="flex items-center justify-end gap-3">
          <Link to="/teacher/lessons"><Button type="button" variant="secondary">Back to lessons</Button></Link>
          <Button type="submit" loading={isSubmitting}>{lesson ? 'Save changes' : 'Create lesson'}</Button>
        </div>
      </form>

      <div className="space-y-6">
        {lesson ? (
          <>
            <PublishPanel lesson={lesson} slideCount={slideCount} onChanged={onSaved} />
            <Card className="p-5">
              <h2 className="font-semibold text-slate-900">Slides</h2>
              <p className="mt-1 text-sm text-slate-500">{slideCount} slide{slideCount === 1 ? '' : 's'}</p>
              <Link to={`/teacher/lessons/${lesson.id}/slides`}><Button variant="secondary" className="mt-3 w-full"><Presentation className="h-4 w-4" aria-hidden /> Open slide editor</Button></Link>
            </Card>
          </>
        ) : <Card className="p-5 text-sm text-slate-600">After you create the lesson you can add slides, then publish or schedule it.</Card>}
      </div>
    </div>
  );
}

export default function LessonFormPage() {
  const { id } = useParams();
  const load = useCallback(async () => {
    const ctx = await loadTeacherContext();
    if (!id) return { ctx, lesson: null as Lesson | null, linked: '', slideCount: 0 };
    const [lesson, linked, slideCount] = await Promise.all([getLesson(id), linkedTopicId(id), countSlides(id)]);
    return { ctx, lesson, linked: linked ?? '', slideCount };
  }, [id]);
  const { data, loading, error, reload } = useAsyncData(load);

  return (
    <>
      <Link to="/teacher/lessons" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> Lesson notes</Link>
      <PageHeader title={id ? data?.lesson?.title ?? 'Lesson' : 'New lesson'} description={id ? 'Edit the details, then add slides and publish.' : 'Start with the basics. You will add slides next.'} />
      {loading && !data ? <div className="flex justify-center py-16"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && id && !data.lesson ? <EmptyState icon={Presentation} title="Lesson not found" description="It may have been deleted, or you may not have access to it." action={<Link to="/teacher/lessons"><Button>Back to lessons</Button></Link>} />
        : data && data.ctx.assignments.length === 0 ? <EmptyState icon={Presentation} title="No classes assigned yet" description="Ask your school administrator to assign you to a class and subject before creating lessons." />
        : data && <LessonForm key={data.lesson?.updated_at ?? 'new'} ctx={data.ctx} lesson={data.lesson} linked={data.linked} slideCount={data.slideCount} onSaved={() => void reload()} />}
    </>
  );
}
