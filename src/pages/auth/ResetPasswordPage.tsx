import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { updatePassword } from '@/services/authService';
import { useAuth } from '@/features/auth/AuthContext';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  if (loading) return <Spinner fullScreen label="Verifying your reset link" />;

  const onSubmit = async (v: Values) => {
    setError(null);
    try { await updatePassword(v.password); toast.success('Password updated'); navigate('/', { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update password.'); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        {!session ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            <TextField label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
          </form>
        )}
      </div>
    </div>
  );
}
