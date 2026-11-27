import { Link } from 'react-router-dom';
import { FOCUS_RING } from '../components/ui/Button';
import { cn } from '../lib/cn';

interface NotFoundProps {
  title?: string;
  description?: string;
}

export function NotFoundView({ title = 'Página não encontrada', description = 'O endereço acessado não existe.' }: NotFoundProps) {
  return (
    <div className="mx-auto my-8 flex max-w-md flex-col items-center gap-4 rounded-3xl border border-purple-100/80 bg-white px-8 py-14 text-center shadow-xs">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      <p className="text-zinc-600">{description}</p>
      <Link
        to="/dashboard"
        className={cn('mt-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-purple-600/25 hover:bg-purple-500', FOCUS_RING)}
      >
        Voltar ao dashboard
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <main className="px-4">
      <NotFoundView />
    </main>
  );
}
