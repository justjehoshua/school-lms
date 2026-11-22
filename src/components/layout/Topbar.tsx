import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge } from '@/components/common/Badge';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = (profile?.full_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const handleSignOut = async () => {
    try { await signOut(); } catch { toast.error('Could not sign out. Try again.'); }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-8">
      <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input type="search" aria-label="Search" placeholder="Search lessons, topics, subjects"
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm" />
      </div>
      <div className="relative ml-auto" ref={ref}>
        <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
          className="flex items-center gap-2 rounded-lg p-1.5 pr-2 hover:bg-slate-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{initials}</span>
          <span className="hidden text-left text-sm font-semibold text-slate-800 sm:block">{profile?.full_name}</span>
          <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-slate-900">{profile?.full_name}</p>
              <div className="mt-1 capitalize"><Badge tone="blue">{profile?.role}</Badge></div>
            </div>
            <button role="menuitem" onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
