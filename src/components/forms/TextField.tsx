import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string; error?: string; hint?: string }

export const TextField = forwardRef<HTMLInputElement, Props>(({ label, error, hint, className, ...rest }, ref) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        id={id} ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn('h-11 w-full rounded-lg border bg-white px-3 text-sm placeholder:text-slate-400', error ? 'border-red-400' : 'border-slate-300', className)}
        {...rest}
      />
      {error ? <p id={`${id}-err`} className="mt-1 text-sm text-red-600">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
});
TextField.displayName = 'TextField';
