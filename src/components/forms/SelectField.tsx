import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string; error?: string; placeholder?: string; options: { value: string; label: string }[];
}

export const SelectField = forwardRef<HTMLSelectElement, Props>(({ label, error, placeholder, options, ...rest }, ref) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <select id={id} ref={ref} aria-invalid={!!error}
        className={`h-11 w-full rounded-lg border bg-white px-3 text-sm ${error ? 'border-red-400' : 'border-slate-300'}`} {...rest}>
        <option value="">{placeholder ?? 'Select…'}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});
SelectField.displayName = 'SelectField';
