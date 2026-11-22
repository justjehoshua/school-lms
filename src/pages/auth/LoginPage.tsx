import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { SetupBanner } from '@/components/common/SetupBanner';
import { ROLE_HOME } from '@/types';

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your registration number or email'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const { session, profile, loading, profileError, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  if (loading) return <Spinner fullScreen label="Checking your session" />;
  if (session && profile) return <Navigate to={ROLE_HOME[profile.role]} replace />;

  const onSubmit = async (v: Values) => {
    setFormError(null);
    try {
      await signIn(v.identifier, v.password);
      toast.success('Signed in');
      navigate('/', { replace: true });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not sign in.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SetupBanner />
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
          <div className="flex items-center gap-2.5"><GraduationCap className="h-7 w-7" aria-hidden /><span className="text-lg font-bold">School LMS</span></div>
          <div>
            <h2 className="max-w-md text-3xl font-bold leading-tight">Lessons, schemes of work and upcoming topics in one place.</h2>
            <p className="mt-4 max-w-md text-brand-200">Teachers prepare lessons as slides. Students open what has been released to them and pick up where they stopped.</p>
          </div>
          <p className="text-sm text-brand-300">Need an account? Your school administrator creates it for you.</p>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Students use their registration number. Teachers and administrators use their email.</p>

            {profileError && session && (
              <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {profileError}{' '}
                <button className="font-semibold underline" onClick={() => void signOut()}>Sign out</button>
              </div>
            )}
            {formError && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <TextField label="Registration number or email" autoComplete="username" error={errors.identifier?.message} {...register('identifier')} />
              <TextField label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
            </form>
            <p className="mt-5 text-center text-sm"><Link to="/forgot-password" className="font-semibold text-brand-700 hover:underline">Forgot your password?</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
