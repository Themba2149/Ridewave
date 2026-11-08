import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'outline' | 'dark';

const base =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-navy-900 hover:bg-accent-dark',
  secondary: 'border border-white/30 text-ink hover:bg-white/10',
  outline: 'border border-navy-900/25 text-navy-900 hover:bg-navy-900/5',
  dark: 'bg-navy-900 text-ink hover:bg-navy-800',
};

export const buttonClasses = (variant: Variant = 'primary', extra = '') => `${base} ${variants[variant]} ${extra}`;

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}

export function ButtonLink({ variant = 'primary', className = '', ...rest }: LinkProps & { variant?: Variant }) {
  return <Link className={buttonClasses(variant, className)} {...rest} />;
}
