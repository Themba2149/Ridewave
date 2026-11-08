import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { loginSchema, type LoginValues } from '../../lib/validators';
import { describeAuthError, safeNextPath } from './auth-errors';
import { homePathFor, useLogin } from './useAuth';

export function LoginPage() {
  useDocumentTitle('Sign In');
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const navigate = useNavigate();
  const next = safeNextPath(useSearchParams()[0].get('next'));
  const login = useLogin();
  const submit = (v: LoginValues) =>
    login.mutate(v, { onSuccess: (d) => navigate(next ?? homePathFor(d.user.role), { replace: true }) });

  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-600">Sign in to your RideWave account.</p>
      <form noValidate onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
        {login.isError && <Alert tone="error">{describeAuthError(login.error)}</Alert>}
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" disabled={login.isPending} className="w-full">{login.isPending ? 'Signing in…' : 'Sign In'}</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="font-medium underline" to="/forgot-password">Forgot your password?</Link></p>
      <p className="mt-2 text-sm">New to RideWave? <Link className="font-medium underline" to="/register">Create an account</Link></p>
    </>
  );
}
