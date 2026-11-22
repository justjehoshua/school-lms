import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'blue' | 'green' | 'amber' | 'gray' | 'red';
const tones: Record<BadgeTone, string> = {
  blue: 'bg-brand-50 text-brand-800 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
};

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone])}>{children}</span>;
}
