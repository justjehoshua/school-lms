import type { BadgeTone } from '@/components/common/Badge';

export type LessonStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export const STATUS_LABEL: Record<LessonStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', published: 'Published', archived: 'Archived' };
export const STATUS_TONE: Record<LessonStatus, BadgeTone> = { draft: 'gray', scheduled: 'amber', published: 'green', archived: 'red' };
