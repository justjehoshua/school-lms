import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { TempPasswordField } from './TempPasswordField';
import { resetPassword } from '@/services/peopleService';
import { friendlyError } from '@/lib/errors';
import { generatePassword } from '@/utils/password';

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters') });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm({ userId, onDone, onCancel }: { userId: string; onDone: (password: string) => void; onCancel: () => void }) {
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { password: generatePassword() },
  });
  const onSubmit = async (v: Values) => {
    try { await resetPassword(userId, v.password); onDone(v.password); }
    catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <TempPasswordField registration={register('password')} error={errors.password?.message}
        onGenerate={() => setValue('password', generatePassword(), { shouldValidate: true })} />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>Set password</Button>
      </div>
    </form>
  );
}
