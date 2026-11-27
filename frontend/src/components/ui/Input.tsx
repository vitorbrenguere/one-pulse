import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { useSurface, type Surface } from './surface';

const BASE = 'w-full border px-4 text-sm transition-colors outline-none focus:ring-2 focus:ring-purple-500 aria-[invalid=true]:border-red-500';

const CONTROL: Record<Surface, string> = {
  light:
    'border-purple-100 bg-white text-zinc-900 placeholder:text-zinc-400 hover:border-purple-200 ' +
    'focus:border-purple-500 disabled:bg-zinc-100',
  dark:
    'border-white/15 bg-white/10 text-white placeholder:text-purple-200 hover:bg-white/15 ' +
    'focus:border-purple-400 [&>option]:text-zinc-900',
};

function useControlClass() {
  return cn(BASE, CONTROL[useSurface()]);
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(useControlClass(), 'h-11 rounded-xl', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(useControlClass(), 'min-h-28 rounded-2xl py-3', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(useControlClass(), 'h-11 cursor-pointer rounded-xl', className)} {...props} />;
}
