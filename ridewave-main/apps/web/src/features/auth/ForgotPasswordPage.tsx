import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../../lib/validators';
import { describeAuthError } from './auth-errors';

export function ForgotPasswordPage() {
  useDocumentTitle('Forgot Password');
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });
  const forgot = useMutation({ mutationFn: (v: ForgotPasswordValues) => apiFetch<{ message: string; devResetPath?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(v) }) });

  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-600">Enter your email. In development mode no email is sent; the reset link is shown on this page instead.</p>
      <form noValidate onSubmit={handleSubmit((v) => forgot.mutate(v))} className="mt-6 space-y-4">
        {forgot.isError && <Alert tone="error">{describeAuthError(forgot.error)}</Alert>}
        {forgot.isSuccess && (
          <Alert tone="success">
            {forgot.data.message}
            {forgot.data.devResetPath && <> <Link className="font-semibold underline" to={forgot.data.devResetPath}>Open reset link</Link></>}
          </Alert>
        )}
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" disabled={forgot.isPending} className="w-full">{forgot.isPending ? 'Please wait…' : 'Continue'}</Button>
      </form>
      <p className="mt-4 text-sm"><Link className="font-medium underline" to="/login">Back to sign in</Link></p>
    </>
  );
}
