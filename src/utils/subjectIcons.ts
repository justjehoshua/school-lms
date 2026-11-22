import { BookOpen, Calculator, Dumbbell, FlaskConical, Globe, HeartPulse, Landmark, Languages, Laptop, Music, Palette, Sprout, type LucideIcon } from 'lucide-react';

export const SUBJECT_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  book: { label: 'Book', icon: BookOpen },
  calculator: { label: 'Mathematics', icon: Calculator },
  flask: { label: 'Science', icon: FlaskConical },
  globe: { label: 'Social studies', icon: Globe },
  laptop: { label: 'Computer', icon: Laptop },
  sprout: { label: 'Agriculture', icon: Sprout },
  palette: { label: 'Arts', icon: Palette },
  heart: { label: 'Health', icon: HeartPulse },
  landmark: { label: 'Civic', icon: Landmark },
  languages: { label: 'Languages', icon: Languages },
  music: { label: 'Music', icon: Music },
  dumbbell: { label: 'Physical education', icon: Dumbbell },
};

export function subjectIcon(name: string | null): LucideIcon {
  return (name && SUBJECT_ICONS[name]?.icon) || BookOpen;
}
