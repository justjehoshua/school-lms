import type { UseFormRegisterReturn } from 'react-hook-form';
import { Wand2 } from 'lucide-react';
import { TextField } from './TextField';
import { Button } from '@/components/common/Button';

/** Temporary passwords are shown in plain text on purpose: the admin has to hand them to the user. */
export function TempPasswordField({ registration, error, onGenerate }: { registration: UseFormRegisterReturn; error?: string; onGenerate: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1"><TextField label="Temporary password" autoComplete="off" error={error} hint="At least 8 characters." {...registration} /></div>
      <Button type="button" variant="secondary" className="mt-[26px]" onClick={onGenerate}><Wand2 className="h-4 w-4" aria-hidden /> Generate</Button>
    </div>
  );
}
