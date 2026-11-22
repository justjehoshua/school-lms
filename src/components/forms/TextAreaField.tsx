import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; error?: string }

export const TextAreaField = forwardRef<HTMLTextAreaElement, Props>(({ label, error, ...rest }, ref) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <textarea id={id} ref={ref} rows={3} aria-invalid={!!error}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm ${error ? 'border-red-400' : 'border-slate-300'}`} {...rest} />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});
TextAreaField.displayName = 'TextAreaField';
