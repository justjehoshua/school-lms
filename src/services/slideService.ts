import { supabase } from '@/lib/supabase';
import { sanitizeHtml } from '@/lib/sanitize';
import { UserFacingError } from '@/lib/errors';
import type { SlideDraft, SlideType } from '@/features/slide-editor/types';

const BUCKET = 'lesson-images';
const check = (res: { error: unknown }) => { if (res.error) throw res.error; };

export async function listSlides(lessonId: string): Promise<SlideDraft[]> {
  const res = await supabase.from('lesson_slides').select('id, slide_type, title, body_html, image_path, layout').eq('lesson_id', lessonId).order('position');
  check(res);
  type Row = { id: string; slide_type: SlideType; title: string | null; body_html: string | null; image_path: string | null; layout: string };
  return ((res.data ?? []) as Row[]).map((r) => ({ id: r.id, slide_type: r.slide_type, title: r.title ?? '', body_html: r.body_html ?? '', image_path: r.image_path, layout: r.layout }));
}

/** Removes deleted slides first (positions must stay unique), then upserts everything in its new order. */
export async function saveSlides(lesson: { id: string; school_id: string }, slides: SlideDraft[], removedIds: string[]) {
  if (removedIds.length) check(await supabase.from('lesson_slides').delete().eq('lesson_id', lesson.id).in('id', removedIds));
  if (!slides.length) return;
  const rows = slides.map((s, i) => ({
    id: s.id, lesson_id: lesson.id, school_id: lesson.school_id, position: i, slide_type: s.slide_type,
    title: s.title.trim() || null, body_html: sanitizeHtml(s.body_html) || null, image_path: s.image_path, layout: s.layout,
  }));
  check(await supabase.from('lesson_slides').upsert(rows, { onConflict: 'id' }));
}

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function uploadSlideImage(schoolId: string, lessonId: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new UserFacingError('Choose a PNG, JPG, WebP or GIF image.');
  if (file.size > 5 * 1024 * 1024) throw new UserFacingError('That image is larger than 5 MB. Choose a smaller one.');
  const path = `${schoolId}/${lessonId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new UserFacingError('The image could not be uploaded. Check your connection and try again.');
  return path;
}

const cache = new Map<string, { url: string; expires: number }>();
/** Images live in a private bucket, so they are shown through short-lived signed links. */
export async function signedImageUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
