import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { TextField } from '@/components/forms/TextField';
import { useAuth } from '@/features/auth/AuthContext';
import { updatePassword, verifyPassword } from '@/services/authService';

const schema = z.object({
  current: z.string().min(1, 'Enter your current password'),
  password: z.string().min(8, 'Use at least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((v) => v.password !== v.current, { path: ['password'], message: 'Choose a password different from your current one' });
type Values = z.infer<typeof schema>;

export default function SettingsPage() {
  const { profile, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (v: Values) => {
    setError(null);
    try {
      await verifyPassword(session?.user.email ?? '', v.current);
      await updatePassword(v.password);
      toast.success('Password updated');
      reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update your password.'); }
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium text-slate-900">{profile?.full_name}</dd></div>
            <div><dt className="text-slate-500">Role</dt><dd className="capitalize"><Badge tone="blue">{profile?.role}</Badge></dd></div>
            <div><dt className="text-slate-500">{profile?.role === 'student' ? 'Registration number' : 'Email'}</dt><dd className="font-medium text-slate-900">{profile?.role === 'student' ? profile.registration_number : profile?.email ?? session?.user.email}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-slate-500">To change your name or login, ask your school administrator.</p>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900">Change password</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            <TextField label="Current password" type="password" autoComplete="current-password" error={errors.current?.message} {...register('current')} />
            <TextField label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            <Button type="submit" loading={isSubmitting}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
