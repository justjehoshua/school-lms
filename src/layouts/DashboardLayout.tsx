import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SetupBanner } from '@/components/common/SetupBanner';
import type { UserRole } from '@/types';

export function DashboardLayout({ role }: { role: UserRole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={role} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SetupBanner />
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
