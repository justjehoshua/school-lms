import { BookOpen, FileText, Image as ImageIcon, Lightbulb, ListChecks, Presentation, Target, type LucideIcon } from 'lucide-react';

export type SlideType = 'title' | 'text' | 'objectives' | 'image_text' | 'example' | 'exercise' | 'summary';

export interface SlideDraft {
  id: string; slide_type: SlideType; title: string; body_html: string; image_path: string | null; layout: string;
}

export const SLIDE_TYPES: Record<SlideType, { label: string; icon: LucideIcon }> = {
  title: { label: 'Title slide', icon: Presentation },
  text: { label: 'Text and explanation', icon: FileText },
  objectives: { label: 'Learning objectives', icon: Target },
  image_text: { label: 'Image and text', icon: ImageIcon },
  example: { label: 'Example', icon: Lightbulb },
  exercise: { label: 'Exercise', icon: ListChecks },
  summary: { label: 'Summary', icon: BookOpen },
};

export const LAYOUTS = [
  { value: 'default', label: 'Standard' },
  { value: 'centered', label: 'Centered' },
  { value: 'image-right', label: 'Image on the right' },
  { value: 'image-left', label: 'Image on the left' },
  { value: 'image-top', label: 'Image on top' },
];

export function newSlide(type: SlideType = 'text'): SlideDraft {
  return {
    id: crypto.randomUUID(), slide_type: type, title: '', body_html: '', image_path: null,
    layout: type === 'title' ? 'centered' : type === 'image_text' ? 'image-right' : 'default',
  };
}
