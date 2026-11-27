import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { useSurface, type Surface } from './surface';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Surface, Record<Variant, string>> = {
  light: {
    primary: 'bg-purple-600 text-white shadow-sm shadow-purple-600/25 hover:bg-purple-500 disabled:bg-purple-300 disabled:shadow-none',
    secondary: 'border border-purple-200 bg-white text-ink-800 hover:border-purple-300 hover:bg-purple-50 disabled:text-zinc-400',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300',
    ghost: 'text-zinc-700 hover:bg-purple-50 disabled:text-zinc-400',
  },
  dark: {
    primary: 'bg-purple-600 text-white shadow-sm shadow-purple-950/40 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-purple-300',
    secondary: 'border border-white/20 bg-white/5 text-white hover:bg-white/15 disabled:text-purple-300',
    danger: 'border border-red-300/40 bg-red-500/10 text-red-100 hover:bg-red-500/20 disabled:text-red-300',
    ghost: 'text-purple-100 hover:bg-white/10 disabled:text-purple-300',
  },
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
};

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2';

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  const surface = useSurface();
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed',
        FOCUS_RING,
        surface === 'dark' && 'focus-visible:ring-offset-ink-900',
        VARIANTS[surface][variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
