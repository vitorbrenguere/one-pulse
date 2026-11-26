import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-xl font-semibold tracking-tight text-zinc-900">OnePulse</p>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="mb-6 text-2xl font-semibold text-zinc-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
