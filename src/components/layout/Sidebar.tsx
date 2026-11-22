import { NavLink } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import { NAV } from './navConfig';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface Props { role: UserRole; open: boolean; onClose: () => void }

export function Sidebar({ role, open, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-950 text-brand-100 transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-16 items-center justify-between px-5">
          <div className="flex items-center gap-2.5 text-white">
            <GraduationCap className="h-6 w-6" aria-hidden />
            <span className="text-base font-bold">School LMS</span>
          </div>
          <button className="rounded p-1 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
          {NAV[role].map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-white/15 text-white' : 'text-brand-200 hover:bg-white/10 hover:text-white',
              )}>
              <Icon className="h-[18px] w-[18px]" aria-hidden />{label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
