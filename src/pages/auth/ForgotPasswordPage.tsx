import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestPasswordReset } from '@/services/authService';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/common/Button';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: Values) => {
    setError(null);
    try { await requestPasswordReset(v.email); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        {sent ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">Staff: enter your email. Students: ask your teacher or administrator to reset your password.</p>
            {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
            </form>
          </>
        )}
        <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-brand-700 hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
