import { useMemo, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { generateSlides, SAMPLE_TEXT, type Density } from './autoSlides';
import type { SlideDraft } from './types';

export function AutoGenerateModal({ open, lessonTitle, hasSlides, onClose, onGenerate }: {
  open: boolean; lessonTitle: string; hasSlides: boolean; onClose: () => void; onGenerate: (slides: SlideDraft[], mode: 'replace' | 'append') => void;
}) {
  const [text, setText] = useState('');
  const [density, setDensity] = useState<Density>('standard');
  const [includeTitleSlide, setIncludeTitleSlide] = useState(true);
  const [mode, setMode] = useState<'replace' | 'append'>(hasSlides ? 'append' : 'replace');
  const preview = useMemo(() => generateSlides(text, { density, includeTitleSlide, lessonTitle }), [text, density, includeTitleSlide, lessonTitle]);

  return (
    <Modal open={open} title="Create slides from text" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
          <p className="font-semibold">How it works</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Start a new slide with <code>## Heading</code>. Use <code># Title</code> for a title slide.</li>
            <li>Use <code>- item</code> for bullets and <code>1. item</code> for numbered steps.</li>
            <li>Headings like Objectives, Example, Exercise and Summary get the matching slide type.</li>
            <li>Long sections are split at sentence or item boundaries so no slide is crowded.</li>
          </ul>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between"><label htmlFor="auto-text" className="text-sm font-medium text-slate-700">Lesson content</label>
            <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setText(SAMPLE_TEXT)}>Insert an example</button></div>
          <textarea id="auto-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm" placeholder={'## Heading\nYour explanation here...'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="density" className="mb-1.5 block text-sm font-medium text-slate-700">Text per slide</label>
            <select id="density" value={density} onChange={(e) => setDensity(e.target.value as Density)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
              <option value="compact">Compact (short slides)</option><option value="standard">Standard</option><option value="detailed">Detailed (more per slide)</option></select></div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={includeTitleSlide} onChange={(e) => setIncludeTitleSlide(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Add a title slide</label>
        </div>
        {hasSlides && (
          <fieldset className="text-sm text-slate-700"><legend className="mb-1 font-medium">This lesson already has slides</legend>
            <label className="mr-5 inline-flex items-center gap-2"><input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} /> Add after existing slides</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace them</label>
          </fieldset>
        )}
        <p className="text-sm text-slate-600" aria-live="polite">{preview.length === 0 ? 'Type or paste some content to see how many slides it makes.' : `This will create ${preview.length} slide${preview.length === 1 ? '' : 's'}. You can edit them all before saving.`}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={preview.length === 0} onClick={() => { onGenerate(preview, hasSlides ? mode : 'replace'); setText(''); }}>Create slides</Button>
        </div>
      </div>
    </Modal>
  );
}
