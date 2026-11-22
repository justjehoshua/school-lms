import { Link } from 'react-router-dom';
import { GraduationCap, LayoutGrid, Library, Users, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/common/Spinner';
import { useAuth } from '@/features/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadAdminCounts } from '@/services/adminService';

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="rounded-lg bg-brand-50 p-3 text-brand-700"><Icon className="h-5 w-5" aria-hidden /></span>
      <div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsyncData(loadAdminCounts);
  return (
    <>
      <PageHeader title={`Welcome, ${profile?.full_name.split(' ')[0] ?? ''}`} description="Set up your school, then add teachers and students." />
      {loading && !data ? <div className="py-12 flex justify-center"><Spinner /></div>
        : error ? <ErrorState message={error} onRetry={() => void reload()} />
        : data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Teachers" value={data.teachers} icon={Users} />
              <Stat label="Students" value={data.students} icon={GraduationCap} />
              <Stat label="Classes" value={data.classes} icon={LayoutGrid} />
              <Stat label="Subjects" value={data.subjects} icon={Library} />
            </div>
            <Card className="mt-6 p-6">
              <h2 className="font-semibold text-slate-900">Suggested setup order</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
                <li><Link className="font-semibold text-brand-700 hover:underline" to="/admin/terms">Add the academic session and its terms</Link></li>
                <li><Link className="font-semibold text-brand-700 hover:underline" to="/admin/subjects">Add your subjects</Link></li>
                <li><Link className="font-semibold text-brand-700 hover:underline" to="/admin/classes">Add classes and choose their subjects</Link></li>
                <li><Link className="font-semibold text-brand-700 hover:underline" to="/admin/teachers">Add teachers</Link>, then <Link className="font-semibold text-brand-700 hover:underline" to="/admin/assignments">assign them to classes and subjects</Link></li>
                <li><Link className="font-semibold text-brand-700 hover:underline" to="/admin/students">Add students and place them in classes</Link></li>
              </ol>
            </Card>
          </>
        )}
    </>
  );
}
