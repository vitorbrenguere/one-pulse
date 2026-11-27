import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { toFormErrors } from '../../../lib/form-errors';
import { ApiError } from '../../../services/http';
import { AuthLayout } from '../components/AuthLayout';
import { useRegister } from '../hooks/useAuthMutations';
import { validateRegister, type FieldErrors } from '../validation';

type RegisterField = 'name' | 'email' | 'password';
const FIELDS: readonly RegisterField[] = ['name', 'email', 'password'];

export function RegisterPage() {
  const register = useRegister();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const [banner, setBanner] = useState<string | null>(null);

  const setField = (field: RegisterField) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (register.isPending) return;
    const clientErrors = validateRegister(values);
    setErrors(clientErrors);
    setBanner(null);
    if (Object.keys(clientErrors).length > 0) return;

    register.mutate(
      { name: values.name.trim(), email: values.email.trim(), password: values.password },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_IN_USE') {
            setErrors({ email: error.message });
            return;
          }
          const formErrors = toFormErrors(error, FIELDS);
          setErrors(formErrors.fieldErrors);
          setBanner(formErrors.banner);
        },
      },
    );
  };

  return (
    <AuthLayout title="Criar conta">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {banner && <ErrorBanner error={banner} />}
        <Field label="Nome" error={errors.name}>
          {(control) => (
            <Input {...control} autoComplete="name" value={values.name} onChange={(e) => setField('name')(e.target.value)} />
          )}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(control) => (
            <Input
              {...control}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => setField('email')(e.target.value)}
            />
          )}
        </Field>
        <Field label="Senha" error={errors.password} hint="8 a 72 caracteres, com ao menos uma letra e um número.">
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => setField('password')(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-zinc-600">
        <Link to="/login" className="rounded font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
          Já tenho conta
        </Link>
      </p>
    </AuthLayout>
  );
}
