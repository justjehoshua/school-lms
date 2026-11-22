import { AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export function SetupBanner() {
  if (isSupabaseConfigured) return null;
  return (
    <div role="alert" className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>Supabase is not connected. Copy <code className="font-semibold">.env.example</code> to <code className="font-semibold">.env</code> and add your project URL and anon key, then restart the dev server.</p>
    </div>
  );
}
