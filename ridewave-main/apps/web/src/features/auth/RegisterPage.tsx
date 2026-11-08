import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { registerSchema, type RegisterValues, type TripPreviewValues } from '../../lib/validators';
import { describeAuthError } from './auth-errors';
import { homePathFor, useRegister } from './useAuth';

const roles = [
  { value: 'PASSENGER', title: 'I want to ride', text: 'Book rides as a passenger' },
  { value: 'DRIVER', title: 'I want to drive', text: 'Apply to become a driver' },
] as const;

export function RegisterPage() {
  useDocumentTitle('Create Account');
  const [params] = useSearchParams();
  const trip = (useLocation().state as { trip?: TripPreviewValues } | null)?.trip;
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: params.get('role') === 'driver' ? 'DRIVER' : 'PASSENGER' },
  });
  const navigate = useNavigate();
  const signUp = useRegister();
  const submit = ({ confirmPassword: _c, phone, ...rest }: RegisterValues) => {
    void _c;
    signUp.mutate({ ...rest, ...(phone ? { phone } : {}) }, { onSuccess: (d) => navigate(homePathFor(d.user.role), { replace: true }) });
  };

  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      {trip && <div className="mt-3"><Alert tone="info">Almost there: create an account to book your trip from <strong>{trip.pickup}</strong> to <strong>{trip.destination}</strong>.</Alert></div>}
      <form noValidate onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
        {signUp.isError && <Alert tone="error">{describeAuthError(signUp.error)}</Alert>}
        <fieldset>
          <legend className="text-sm font-medium">Account type</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {roles.map((r) => (
              <label key={r.value} className="flex min-h-[44px] cursor-pointer flex-col rounded-lg border border-navy-900/25 p-3 has-[:checked]:border-navy-900 has-[:checked]:bg-accent/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500">
                <input type="radio" value={r.value} className="sr-only" {...register('role')} />
                <span className="font-semibold">{r.title}</span><span className="text-xs text-slate-600">{r.text}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-600">Driver accounts must be approved before receiving rides.</p>
        </fieldset>
        <TextField label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        <TextField label="Password" type="password" autoComplete="new-password" hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" disabled={signUp.isPending} className="w-full">{signUp.isPending ? 'Creating account…' : 'Create account'}</Button>
      </form>
      <p className="mt-4 text-sm">Already registered? <Link className="font-medium underline" to="/login">Sign in</Link></p>
    </>
  );
}
