import { Badge } from '@/components/common/Badge';

export type DisplayStatus = 'available' | 'in_progress' | 'completed' | 'coming_soon';
const MAP: Record<DisplayStatus, { label: string; tone: 'blue' | 'amber' | 'green' | 'gray' }> = {
  available: { label: 'Available', tone: 'blue' }, in_progress: { label: 'In progress', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' }, coming_soon: { label: 'Coming soon', tone: 'gray' },
};
export const StatusBadge = ({ status }: { status: DisplayStatus }) => <Badge tone={MAP[status].tone}>{MAP[status].label}</Badge>;
