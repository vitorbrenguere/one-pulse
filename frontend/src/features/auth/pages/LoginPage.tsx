import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { ErrorBanner, Notice } from '../../../components/ui/States';
import { toFormErrors } from '../../../lib/form-errors';
import { ApiError } from '../../../services/http';
import { AuthLayout } from '../components/AuthLayout';
import { useLogin } from '../hooks/useAuthMutations';
import { readAuthRedirectState } from '../redirect-state';
import { validateLogin, type FieldErrors } from '../validation';

type LoginField = 'email' | 'password';
const FIELDS: readonly LoginField[] = ['email', 'password'];

export function LoginPage() {
  const { notice } = readAuthRedirectState(useLocation().state);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (login.isPending) return;
    const clientErrors = validateLogin({ email, password });
    setErrors(clientErrors);
    setBanner(null);
    if (Object.keys(clientErrors).length > 0) return;

    login.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          const formErrors = toFormErrors(error, FIELDS);
          setErrors(formErrors.fieldErrors);
          setBanner(formErrors.banner);
          if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') setPassword('');
        },
      },
    );
  };

  return (
    <AuthLayout title="Entrar">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {notice && <Notice>{notice}</Notice>}
        {banner && <ErrorBanner error={banner} />}
        <Field label="E-mail" error={errors.email}>
          {(control) => (
            <Input {...control} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="Senha" error={errors.password}>
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-zinc-600">
        Ainda não tem conta?{' '}
        <Link to="/register" className="rounded font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
