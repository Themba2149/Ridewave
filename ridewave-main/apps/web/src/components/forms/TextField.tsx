import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type Common = { label: string; error?: string; hint?: string };
const field =
  'mt-1 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-navy-900 placeholder:text-slate-400 min-h-[44px] ' +
  'border-navy-900/25 aria-[invalid=true]:border-danger';

function Wrapper({ id, label, error, hint, children }: Common & { id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

const describe = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={describe(id, error, hint)} className={`${field} ${className}`} {...rest} />
    </Wrapper>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextAreaField(
  { label, error, hint, className = '', ...rest }, ref) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint}>
      <textarea ref={ref} id={id} rows={5} aria-invalid={!!error} aria-describedby={describe(id, error, hint)} className={`${field} ${className}`} {...rest} />
    </Wrapper>
  );
});
