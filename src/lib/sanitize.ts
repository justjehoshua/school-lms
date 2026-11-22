import DOMPurify from 'dompurify';

// Slides only need basic formatting: no links, images, styles, scripts or attributes at all.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

export function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
export function wordCount(html: string): number {
  const t = plainText(html);
  return t ? t.split(' ').length : 0;
}
