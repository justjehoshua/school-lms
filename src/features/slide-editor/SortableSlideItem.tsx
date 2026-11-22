import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { SLIDE_TYPES, type SlideDraft } from './types';
import { cn } from '@/lib/utils';

export function SortableSlideItem({ slide, index, selected, onSelect, onDuplicate, onDelete }: {
  slide: SlideDraft; index: number; selected: boolean; onSelect: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const Icon = SLIDE_TYPES[slide.slide_type].icon;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-lg border bg-white p-1.5', selected ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200', isDragging && 'z-10 opacity-80 shadow-lg')}>
      <button type="button" aria-label={`Drag slide ${index + 1} to reorder`} className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      <button type="button" onClick={onSelect} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left">
        <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">{index + 1}</span>
        <Icon className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />
        <span className="truncate text-sm text-slate-800">{slide.title || 'Untitled slide'}</span>
      </button>
      <button type="button" aria-label={`Duplicate slide ${index + 1}`} onClick={onDuplicate} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Copy className="h-4 w-4" /></button>
      <button type="button" aria-label={`Delete slide ${index + 1}`} onClick={onDelete} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
    </li>
  );
}
