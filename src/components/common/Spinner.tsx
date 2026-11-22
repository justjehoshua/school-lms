import { Loader2 } from 'lucide-react';

export function Spinner({ fullScreen, label = 'Loading' }: { fullScreen?: boolean; label?: string }) {
  const inner = (
    <div role="status" className="flex flex-col items-center gap-3 text-slate-500">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
  return fullScreen ? <div className="flex h-full min-h-screen items-center justify-center">{inner}</div> : inner;
}
