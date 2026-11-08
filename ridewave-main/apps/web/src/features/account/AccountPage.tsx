import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';
import { changePasswordSchema, profileSchema, type ChangePasswordValues, type ProfileValues } from '../../lib/validators';
import { useCurrentUser, type AuthUser } from '../auth/useAuth';

function ProfileForm({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, phone: user.phone ?? '' },
  });
  const save = useMutation({
    mutationFn: (v: ProfileValues) => apiFetch<{ user: AuthUser }>('/users/me', { method: 'PATCH', body: JSON.stringify({ fullName: v.fullName, phone: v.phone || null }) }),
    onSuccess: (d) => qc.setQueryData(['me'], d.user),
  });
  return (
    <Card>
      <h2 className="text-xl font-bold">Profile</h2>
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="mt-4 space-y-4">
        {save.isSuccess && <Alert tone="success">Profile saved.</Alert>}
        {save.isError && <Alert tone="error">{save.error.message}</Alert>}
        <TextField label="Email" value={user.email} readOnly hint="Email cannot be changed here." />
        <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <TextField label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) });
  const change = useMutation({
    mutationFn: (v: ChangePasswordValues) => apiFetch<{ message: string }>('/users/me/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: v.currentPassword, newPassword: v.newPassword }) }),
    onSuccess: () => reset(),
  });
  return (
    <Card>
      <h2 className="text-xl font-bold">Change password</h2>
      <form noValidate onSubmit={handleSubmit((v) => change.mutate(v))} className="mt-4 space-y-4">
        {change.isSuccess && <Alert tone="success">{change.data.message}</Alert>}
        {change.isError && <Alert tone="error">{change.error.message}</Alert>}
        <TextField label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <TextField label="New password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." error={errors.newPassword?.message} {...register('newPassword')} />
        <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" disabled={change.isPending}>{change.isPending ? 'Updating…' : 'Change password'}</Button>
      </form>
    </Card>
  );
}

export function AccountPage() {
  useDocumentTitle('Account');
  const { data: user } = useCurrentUser();
  if (!user) return null;
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}
