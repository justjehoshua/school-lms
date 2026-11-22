import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitize';
import { signedImageUrl } from '@/services/slideService';
import { SLIDE_TYPES, type SlideDraft } from '@/features/slide-editor/types';
import { cn } from '@/lib/utils';

export type PlayerSlide = SlideDraft;

function SlideImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(null); setFailed(false);
    signedImageUrl(path).then((u) => { if (!active) return; if (u) setUrl(u); else setFailed(true); }).catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [path]);
  if (failed) return <div className="flex h-48 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm text-slate-500"><ImageOff className="h-5 w-5" aria-hidden /> Image unavailable</div>;
  if (!url) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" aria-hidden />;
  return <img src={url} alt={alt} className="mx-auto max-h-[55vh] w-full rounded-xl object-contain" onError={() => setFailed(true)} />;
}

const ACCENT: Partial<Record<PlayerSlide['slide_type'], string>> = {
  objectives: 'border-brand-500', example: 'border-emerald-500', exercise: 'border-amber-500', summary: 'border-violet-500',
};

export function SlideRenderer({ slide }: { slide: PlayerSlide }) {
  const html = useMemo(() => sanitizeHtml(slide.body_html), [slide.body_html]);
  const hasImage = !!slide.image_path;
  const layout = hasImage && slide.layout === 'default' ? 'image-right' : slide.layout;
  const meta = SLIDE_TYPES[slide.slide_type];
  const Icon = meta.icon;
  const title = slide.title || (slide.slide_type === 'title' ? '' : 'Untitled slide');

  if (slide.slide_type === 'title' || layout === 'centered') {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-3xl flex-col items-center justify-center text-center">
        {hasImage && <div className="mb-6 w-full max-w-md"><SlideImage path={slide.image_path!} alt={title} /></div>}
        <h1 className="text-3xl font-bold text-slate-900 md:text-5xl">{title}</h1>
        {html && <div className="slide-body mt-6 text-slate-600" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    );
  }

  const text = (
    <div className="min-w-0">
      <div className={cn('mb-4 flex items-center gap-2', ACCENT[slide.slide_type] ? 'border-l-4 pl-3' : '', ACCENT[slide.slide_type])}>
        {slide.slide_type !== 'text' && slide.slide_type !== 'image_text' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4" aria-hidden />{meta.label}</span>
        )}
      </div>
      <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">{title}</h2>
      <div className="slide-body mt-4" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
  if (!hasImage) return <div className="mx-auto max-w-4xl">{text}</div>;

  const img = <div className="flex items-center"><div className="w-full"><SlideImage path={slide.image_path!} alt={title} /></div></div>;
  if (layout === 'image-top') return <div className="mx-auto max-w-4xl space-y-6">{img}{text}</div>;
  return (
    <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2 md:items-center">
      {layout === 'image-left' ? <>{img}{text}</> : <>{text}{img}</>}
    </div>
  );
}
