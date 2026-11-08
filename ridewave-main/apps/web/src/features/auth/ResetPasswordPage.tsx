import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';
import { resetPasswordSchema, type ResetPasswordValues } from '../../lib/validators';
import { describeAuthError } from './auth-errors';

export function ResetPasswordPage() {
  useDocumentTitle('Choose a New Password');
  const token = useSearchParams()[0].get('token') ?? '';
  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });
  const reset = useMutation({ mutationFn: (v: ResetPasswordValues) => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: v.password }) }) });

  if (!token) {
    return (<><h1 className="text-2xl font-bold">Reset link missing</h1><div className="mt-4"><Alert tone="error">This page needs a reset link. Request a new one from the forgot-password page.</Alert></div><p className="mt-4 text-sm"><Link className="font-medium underline" to="/forgot-password">Request a reset link</Link></p></>);
  }
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <form noValidate onSubmit={handleSubmit((v) => reset.mutate(v))} className="mt-6 space-y-4">
        {reset.isError && <Alert tone="error">{describeAuthError(reset.error)}</Alert>}
        {reset.isSuccess && <Alert tone="success">Password updated. You can now <Link className="underline" to="/login">sign in</Link>.</Alert>}
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" disabled={reset.isPending} className="w-full">{reset.isPending ? 'Saving…' : 'Update password'}</Button>
      </form>
    </>
  );
}
