import { BookOpen, BookText, CalendarClock, CheckCircle2, ClipboardList, GraduationCap, Home, LayoutGrid, Library, Presentation, Settings, Users, BarChart3, School, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/types';

export interface NavItem { label: string; to: string; icon: LucideIcon; end?: boolean }

export const NAV: Record<UserRole, NavItem[]> = {
  teacher: [
    { label: 'Dashboard', to: '/teacher', icon: Home, end: true },
    { label: 'My Classes', to: '/teacher/classes', icon: School },
    { label: 'My Subjects', to: '/teacher/subjects', icon: Library },
    { label: 'Scheme of Work', to: '/teacher/schemes', icon: ClipboardList },
    { label: 'Lesson Notes', to: '/teacher/lessons', icon: BookText },
    { label: 'Slide Editor', to: '/teacher/editor', icon: Presentation },
    { label: 'Upcoming Topics', to: '/teacher/upcoming', icon: CalendarClock },
    { label: 'Published Lessons', to: '/teacher/published', icon: CheckCircle2 },
    { label: 'Student Progress', to: '/teacher/progress', icon: BarChart3 },
    { label: 'Settings', to: '/teacher/settings', icon: Settings },
  ],
  student: [
    { label: 'Dashboard', to: '/student', icon: Home, end: true },
    { label: 'Subjects', to: '/student/subjects', icon: Library },
    { label: 'Lessons', to: '/student/lessons', icon: BookOpen },
    { label: 'Scheme of Work', to: '/student/scheme', icon: ClipboardList },
    { label: 'Upcoming Topics', to: '/student/upcoming', icon: CalendarClock },
    { label: 'Settings', to: '/student/settings', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: Home, end: true },
    { label: 'Teachers', to: '/admin/teachers', icon: Users },
    { label: 'Students', to: '/admin/students', icon: GraduationCap },
    { label: 'Classes', to: '/admin/classes', icon: LayoutGrid },
    { label: 'Subjects', to: '/admin/subjects', icon: Library },
    { label: 'Assignments', to: '/admin/assignments', icon: ClipboardList },
    { label: 'Sessions & Terms', to: '/admin/terms', icon: CalendarClock },
    { label: 'Lessons Overview', to: '/admin/lessons', icon: BookText },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
  ],
};
