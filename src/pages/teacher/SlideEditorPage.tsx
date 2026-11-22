import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';
import { AlertTriangle, ArrowLeft, ImagePlus, Play, Plus, Presentation, Save, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { Badge } from '@/components/common/Badge';
import { SlidePlayer } from '@/components/slides/SlidePlayer';
import { RichTextEditor } from '@/features/slide-editor/RichTextEditor';
import { SortableSlideItem } from '@/features/slide-editor/SortableSlideItem';
import { AutoGenerateModal } from '@/features/slide-editor/AutoGenerateModal';
import { LAYOUTS, newSlide, SLIDE_TYPES, type SlideDraft, type SlideType } from '@/features/slide-editor/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { getLesson, type Lesson } from '@/services/lessonService';
import { listSlides, saveSlides, uploadSlideImage } from '@/services/slideService';
import { wordCount } from '@/lib/sanitize';
import { friendlyError } from '@/lib/errors';
import { STATUS_LABEL, STATUS_TONE } from '@/utils/lessonStatus';

function Editor({ lesson, initial }: { lesson: Lesson; initial: SlideDraft[] }) {
  const [slides, setSlides] = useState<SlideDraft[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const baseline = useRef(JSON.stringify(initial));
  const savedIds = useRef<string[]>(initial.map((s) => s.id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [deleting, setDeleting] = useState<SlideDraft | null>(null);
  const [newType, setNewType] = useState<SlideType>('text');
  const [, force] = useState(0);

  const dirty = JSON.stringify(slides) !== baseline.current;
  useUnsavedWarning(dirty);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const selectedIndex = slides.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? slides[selectedIndex] : null;
  const ids = useMemo(() => slides.map((s) => s.id), [slides]);

  const update = (id: string, patch: Partial<SlideDraft>) => setSlides((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const onBody = useCallback((html: string) => { if (selectedId) setSlides((all) => all.map((s) => (s.id === selectedId ? { ...s, body_html: html } : s))); }, [selectedId]);

  const add = () => {
    const s = newSlide(newType);
    setSlides((all) => { const at = selectedIndex >= 0 ? selectedIndex + 1 : all.length; return [...all.slice(0, at), s, ...all.slice(at)]; });
    setSelectedId(s.id);
  };
  const duplicate = (slide: SlideDraft) => {
    const copy: SlideDraft = { ...slide, id: crypto.randomUUID(), title: slide.title ? `${slide.title} (copy)` : '' };
    setSlides((all) => { const at = all.findIndex((s) => s.id === slide.id) + 1; return [...all.slice(0, at), copy, ...all.slice(at)]; });
    setSelectedId(copy.id);
  };
  const remove = (slide: SlideDraft) => {
    const i = slides.findIndex((s) => s.id === slide.id);
    const rest = slides.filter((s) => s.id !== slide.id);
    setSlides(rest);
    if (selectedId === slide.id) setSelectedId(rest[Math.min(i, rest.length - 1)]?.id ?? null);
    setDeleting(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setSlides((all) => arrayMove(all, all.findIndex((s) => s.id === e.active.id), all.findIndex((s) => s.id === e.over!.id)));
  };

  const onGenerate = (generated: SlideDraft[], mode: 'replace' | 'append') => {
    setSlides((all) => (mode === 'replace' ? generated : [...all, ...generated]));
    setSelectedId(generated[0]?.id ?? null);
    setAutoOpen(false);
    toast.success(`${generated.length} slides created. Review them, then save.`);
  };

  const save = async () => {
    setSaving(true);
    try {
      const removed = savedIds.current.filter((id) => !ids.includes(id));
      await saveSlides(lesson, slides, removed);
      baseline.current = JSON.stringify(slides);
      savedIds.current = ids;
      force((n) => n + 1);
      toast.success('Slides saved');
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setSaving(false); }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !selected) return;
    setUploading(true);
    try { update(selected.id, { image_path: await uploadSlideImage(lesson.school_id, lesson.id, file) }); }
    catch (e) { toast.error(friendlyError(e)); }
    finally { setUploading(false); }
  };

  const words = selected ? wordCount(selected.body_html) : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/teacher/lessons/${lesson.id}`} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden /> Lesson details</Link>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">{lesson.title}</h1><Badge tone={STATUS_TONE[lesson.status]}>{STATUS_LABEL[lesson.status]}</Badge></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-sm font-medium text-amber-700">Unsaved changes</span>}
          <Button variant="secondary" onClick={() => setAutoOpen(true)}><Sparkles className="h-4 w-4" aria-hidden /> Create from text</Button>
          <Button variant="secondary" disabled={slides.length === 0} onClick={() => setPreviewing(true)}><Play className="h-4 w-4" aria-hidden /> Preview</Button>
          <Button loading={saving} disabled={!dirty} onClick={() => void save()}><Save className="h-4 w-4" aria-hidden /> Save slides</Button>
        </div>
      </div>

      {lesson.status === 'published' && <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />This lesson is published. Students will see your changes as soon as you save.</p>}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <Card className="p-3">
          <div className="mb-3 flex gap-2">
            <select aria-label="Type of new slide" value={newType} onChange={(e) => setNewType(e.target.value as SlideType)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-sm">
              {(Object.keys(SLIDE_TYPES) as SlideType[]).map((t) => <option key={t} value={t}>{SLIDE_TYPES[t].label}</option>)}
            </select>
            <Button size="sm" onClick={add}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
          </div>
          {slides.length === 0 ? <p className="px-1 py-6 text-center text-sm text-slate-500">No slides yet.</p> : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
                  {slides.map((s, i) => <SortableSlideItem key={s.id} slide={s} index={i} selected={s.id === selectedId} onSelect={() => setSelectedId(s.id)} onDuplicate={() => duplicate(s)} onDelete={() => setDeleting(s)} />)}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </Card>

        <Card className="p-5">
          {!selected ? (
            <EmptyState icon={Presentation} title="Build your lesson" description="Add a slide on the left, or paste your lesson text and let the editor divide it into slides."
              action={<div className="flex flex-wrap justify-center gap-3"><Button onClick={add}><Plus className="h-4 w-4" aria-hidden /> Add first slide</Button><Button variant="secondary" onClick={() => setAutoOpen(true)}><Sparkles className="h-4 w-4" aria-hidden /> Create from text</Button></div>} />
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="slide-title" className="mb-1.5 block text-sm font-medium text-slate-700">Slide title</label>
                <input id="slide-title" value={selected.title} maxLength={200} onChange={(e) => update(selected.id, { title: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-lg font-semibold" placeholder="Slide title" />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">{selected.slide_type === 'title' ? 'Subtitle' : 'Content'}</p>
                <RichTextEditor key={selected.id} value={selected.body_html} onChange={onBody} />
              </div>
              <p className={words > 110 ? 'flex items-center gap-1.5 text-sm font-medium text-amber-700' : 'text-sm text-slate-500'}>
                {words > 110 && <AlertTriangle className="h-4 w-4" aria-hidden />}{words} words{words > 110 ? '. This is a lot for one slide. Consider splitting it.' : ''}
              </p>
            </div>
          )}
        </Card>

        <Card className="space-y-5 p-4">
          <h2 className="font-semibold text-slate-900">Slide settings</h2>
          {!selected ? <p className="text-sm text-slate-500">Select a slide to change its type, layout or image.</p> : (
            <>
              <div>
                <label htmlFor="slide-type" className="mb-1.5 block text-sm font-medium text-slate-700">Slide type</label>
                <select id="slide-type" value={selected.slide_type} onChange={(e) => update(selected.id, { slide_type: e.target.value as SlideType })} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {(Object.keys(SLIDE_TYPES) as SlideType[]).map((t) => <option key={t} value={t}>{SLIDE_TYPES[t].label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="slide-layout" className="mb-1.5 block text-sm font-medium text-slate-700">Layout</label>
                <select id="slide-layout" value={selected.layout} onChange={(e) => update(selected.id, { layout: e.target.value })} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Image</p>
                {selected.image_path ? (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Image attached
                    <Button variant="ghost" size="sm" onClick={() => update(selected.id, { image_path: null })}><X className="h-4 w-4" aria-hidden /> Remove</Button></div>
                ) : <p className="mb-2 text-sm text-slate-500">No image on this slide.</p>}
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  <ImagePlus className="h-4 w-4" aria-hidden /> {uploading ? 'Uploading…' : selected.image_path ? 'Replace image' : 'Upload image'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <p className="mt-1.5 text-xs text-slate-500">PNG, JPG, WebP or GIF, up to 5 MB. The slide title is used as the image description for screen readers.</p>
              </div>
            </>
          )}
        </Card>
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 bg-white" role="dialog" aria-modal="true" aria-label="Lesson preview">
          <SlidePlayer slides={slides} heading={lesson.title} subheading="Preview (progress is not recorded)" initialIndex={Math.max(0, selectedIndex)} onExit={() => setPreviewing(false)} />
        </div>
      )}
      <AutoGenerateModal key={slides.length === 0 ? 'empty' : 'has'} open={autoOpen} lessonTitle={lesson.title} hasSlides={slides.length > 0} onClose={() => setAutoOpen(false)} onGenerate={onGenerate} />
      <ConfirmDialog open={!!deleting} title="Delete this slide?" message="It will be removed when you click Save slides. Until then you can leave the page to discard the change." onConfirm={() => deleting && remove(deleting)} onCancel={() => setDeleting(null)} />
    </>
  );
}

export default function SlideEditorPage() {
  const { id } = useParams();
  const load = useCallback(async () => {
    if (!id) return { lesson: null as Lesson | null, slides: [] as SlideDraft[] };
    const [lesson, slides] = await Promise.all([getLesson(id), listSlides(id)]);
    return { lesson, slides };
  }, [id]);
  const { data, loading, error, reload } = useAsyncData(load);

  if (loading && !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <ErrorState message={error} onRetry={() => void reload()} />;
  if (!data?.lesson) return <EmptyState icon={Presentation} title="Lesson not found" description="It may have been deleted, or you may not have access to it." action={<Link to="/teacher/lessons"><Button>Back to lessons</Button></Link>} />;
  if (data.lesson.status === 'archived') return <EmptyState icon={Presentation} title="This lesson is archived" description="Restore it to drafts to edit its slides." action={<Link to={`/teacher/lessons/${data.lesson.id}`}><Button>Open lesson details</Button></Link>} />;
  return <Editor lesson={data.lesson} initial={data.slides} />;
}
