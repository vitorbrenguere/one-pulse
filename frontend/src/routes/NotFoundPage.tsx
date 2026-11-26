import { Link } from 'react-router-dom';
import { FOCUS_RING } from '../components/ui/Button';
import { cn } from '../lib/cn';

interface NotFoundProps {
  title?: string;
  description?: string;
}

export function NotFoundView({ title = 'Página não encontrada', description = 'O endereço acessado não existe.' }: NotFoundProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p className="text-zinc-600">{description}</p>
      <Link
        to="/dashboard"
        className={cn('rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700', FOCUS_RING)}
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
