import { newSlide, type SlideDraft, type SlideType } from './types';

export type Density = 'compact' | 'standard' | 'detailed';
export interface AutoOptions { density: Density; includeTitleSlide: boolean; lessonTitle: string }

const LIMITS: Record<Density, { words: number; items: number }> = {
  compact: { words: 45, items: 4 }, standard: { words: 75, items: 6 }, detailed: { words: 120, items: 8 },
};

type Block = { kind: 'p'; text: string } | { kind: 'ul' | 'ol'; items: string[] };
interface Section { title: string | null; level: number; blocks: Block[] }

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const blockWords = (b: Block) => (b.kind === 'p' ? words(b.text) : b.items.reduce((n, i) => n + words(i), 0));

/** Reads simple structured text: "# Title", "## Heading", "- bullets", "1. steps", blank-line paragraphs. */
function parse(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { title: null, level: 2, blocks: [] };
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flush = () => {
    if (para.length) { current.blocks.push({ kind: 'p', text: para.join(' ') }); para = []; }
    if (list) { current.blocks.push(list); list = null; }
  };
  const startSection = (title: string | null, level: number) => {
    flush();
    if (current.title !== null || current.blocks.length) sections.push(current);
    current = { title, level, blocks: [] };
  };

  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (heading) { startSection(heading[2].trim(), heading[1].length); }
    else if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (para.length) { current.blocks.push({ kind: 'p', text: para.join(' ') }); para = []; }
      if (list && list.kind !== kind) { current.blocks.push(list); list = null; }
      if (!list) list = { kind, items: [] };
      list.items.push((bullet ?? numbered)![1].trim());
    } else if (line === '') { flush(); }
    else {
      if (list) { current.blocks.push(list); list = null; }
      para.push(line);
    }
  }
  flush();
  if (current.title !== null || current.blocks.length) sections.push(current);
  return sections;
}

/** Splits one oversized block on sentence or item boundaries, never mid-sentence. */
function splitBlock(b: Block, lim: { words: number; items: number }): Block[] {
  if (b.kind === 'p') {
    if (words(b.text) <= lim.words) return [b];
    const sentences = b.text.split(/(?<=[.!?])\s+/);
    const out: Block[] = []; let cur: string[] = [];
    for (const s of sentences) {
      if (cur.length && words(cur.join(' ')) + words(s) > lim.words) { out.push({ kind: 'p', text: cur.join(' ') }); cur = []; }
      cur.push(s);
    }
    if (cur.length) out.push({ kind: 'p', text: cur.join(' ') });
    return out;
  }
  if (b.items.length <= lim.items && blockWords(b) <= lim.words) return [b];
  const out: Block[] = []; let cur: string[] = [];
  for (const item of b.items) {
    if (cur.length && (cur.length >= lim.items || cur.reduce((n, i) => n + words(i), 0) + words(item) > lim.words)) { out.push({ kind: b.kind, items: cur }); cur = []; }
    cur.push(item);
  }
  if (cur.length) out.push({ kind: b.kind, items: cur });
  return out;
}

function packBlocks(blocks: Block[], lim: { words: number; items: number }): Block[][] {
  const pages: Block[][] = []; let cur: Block[] = []; let w = 0; let n = 0;
  const push = () => { if (cur.length) { pages.push(cur); cur = []; w = 0; n = 0; } };
  for (const block of blocks) for (const piece of splitBlock(block, lim)) {
    const pw = blockWords(piece); const pn = piece.kind === 'p' ? 0 : piece.items.length;
    if (cur.length && (w + pw > lim.words || n + pn > lim.items)) push();
    cur.push(piece); w += pw; n += pn;
  }
  push();
  return pages;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
const toHtml = (blocks: Block[]) => blocks.map((b) => (b.kind === 'p' ? `<p>${inline(b.text)}</p>` : `<${b.kind}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${b.kind}>`)).join('');

function inferType(title: string): SlideType {
  if (/objective|aims?\b|by the end/i.test(title)) return 'objectives';
  if (/example|worked|illustrat/i.test(title)) return 'example';
  if (/exercise|practice|activity|quiz|assignment|questions?/i.test(title)) return 'exercise';
  if (/summary|recap|conclusion|key points|remember/i.test(title)) return 'summary';
  return 'text';
}

export function generateSlides(text: string, opts: AutoOptions): SlideDraft[] {
  if (!text.trim()) return [];
  const lim = LIMITS[opts.density];
  const sections = parse(text);
  const slides: SlideDraft[] = [];

  const hasOwnTitle = sections.some((s) => s.level === 1);
  if (opts.includeTitleSlide && !hasOwnTitle && opts.lessonTitle.trim()) {
    slides.push({ ...newSlide('title'), title: opts.lessonTitle.trim() });
  }

  for (const sec of sections) {
    if (sec.level === 1) {
      slides.push({ ...newSlide('title'), title: sec.title ?? opts.lessonTitle, body_html: toHtml(sec.blocks.slice(0, 1)) });
      if (sec.blocks.length > 1) {
        packBlocks(sec.blocks.slice(1), lim).forEach((page, i) => slides.push({ ...newSlide('text'), title: i === 0 ? 'Introduction' : 'Introduction (cont.)', body_html: toHtml(page) }));
      }
      continue;
    }
    const title = sec.title ?? 'Introduction';
    const type = inferType(title);
    const pages = sec.blocks.length ? packBlocks(sec.blocks, lim) : [[]];
    pages.forEach((page, i) => slides.push({ ...newSlide(type), title: i === 0 ? title : `${title} (cont.)`, body_html: toHtml(page) }));
  }
  return slides;
}

export const SAMPLE_TEXT = `# Adding Fractions
A short lesson on adding fractions with the same denominator.

## Learning objectives
- Recognise the numerator and the denominator
- Add fractions that share a denominator
- Write the answer in its simplest form

## What is a fraction?
A fraction describes part of a whole. The top number, called the numerator, tells us how many parts we have. The bottom number, called the denominator, tells us how many equal parts the whole is divided into.

## Worked example
Add 2/8 and 3/8. The denominators are the same, so we add the numerators: 2 + 3 = 5. The answer is 5/8.

## Practice exercise
1. 1/5 + 2/5
2. 3/10 + 4/10
3. 2/9 + 5/9

## Summary
- Same denominator: add the numerators only
- Keep the denominator unchanged
- Always simplify the answer
`;
