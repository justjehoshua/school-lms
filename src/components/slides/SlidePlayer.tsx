import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, LayoutGrid, Minimize, X } from 'lucide-react';
import { SlideRenderer, type PlayerSlide } from './SlideRenderer';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

interface Props {
  slides: PlayerSlide[]; heading: string; subheading?: string; initialIndex?: number;
  onIndexChange?: (index: number) => void; onComplete?: () => void; onExit?: () => void;
}

/** Used for the teacher preview now and the student lesson viewer next. */
export function SlidePlayer({ slides, heading, subheading, initialIndex = 0, onIndexChange, onComplete, onExit }: Props) {
  const last = slides.length - 1;
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, last)));
  const [showThumbs, setShowThumbs] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const completed = useRef(false);

  const go = useCallback((i: number) => {
    const next = Math.max(0, Math.min(i, last));
    setIndex(next);
    onIndexChange?.(next);
  }, [last, onIndexChange]);

  useEffect(() => {
    if (last >= 0 && index === last && !completed.current) { completed.current = true; onComplete?.(); }
  }, [index, last, onComplete]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(last);
      else if (e.key.toLowerCase() === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, last, toggleFullscreen]);

  if (slides.length === 0) {
    return <div className="flex h-full min-h-[300px] items-center justify-center p-8 text-center text-slate-500">This lesson has no slides yet.</div>;
  }
  const slide = slides[index];
  const pct = slides.length === 1 ? 100 : Math.round((index / last) * 100);

  return (
    <div ref={rootRef} className="slide-large flex h-full min-h-[480px] flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{heading}</p>{subheading && <p className="truncate text-sm text-slate-500">{subheading}</p>}</div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" aria-label="Show slide list" aria-pressed={showThumbs} onClick={() => setShowThumbs((v) => !v)}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>{fullscreen ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</Button>
          {onExit && <Button variant="ghost" size="sm" aria-label="Close" onClick={onExit}><X className="h-4 w-4" /></Button>}
        </div>
      </div>
      <div className="h-1.5 bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Lesson progress">
        <div className="h-full bg-brand-600 transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>

      <div key={slide.id} className="slide-fade flex-1 overflow-y-auto p-6 md:p-12"><SlideRenderer slide={slide} /></div>

      {showThumbs && (
        <div className="flex gap-2 overflow-x-auto border-t border-slate-200 bg-slate-50 p-3">
          {slides.map((s, i) => (
            <button key={s.id} onClick={() => go(i)} aria-current={i === index} className={cn('w-36 shrink-0 rounded-lg border bg-white p-2 text-left text-xs', i === index ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200 hover:border-slate-400')}>
              <span className="font-semibold text-slate-500">{i + 1}</span><span className="mt-0.5 block truncate text-slate-800">{s.title || 'Untitled slide'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}><ChevronLeft className="h-4 w-4" aria-hidden /> Previous</Button>
        <span className="text-sm font-medium text-slate-600" aria-live="polite">{index + 1} / {slides.length}</span>
        <Button onClick={() => (index === last ? onExit?.() : go(index + 1))} disabled={index === last && !onExit}>{index === last ? 'Finish' : 'Next'} {index !== last && <ChevronRight className="h-4 w-4" aria-hidden />}</Button>
      </div>
    </div>
  );
}
