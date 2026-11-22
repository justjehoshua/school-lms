import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface Credentials { name: string; loginId: string; password: string }

export function CredentialsDialog({ creds, onClose }: { creds: Credentials | null; onClose: () => void }) {
  const copy = async () => {
    if (!creds) return;
    try { await navigator.clipboard.writeText(`Login: ${creds.loginId}\nPassword: ${creds.password}`); toast.success('Copied'); }
    catch { toast.error('Could not copy. Select the text and copy it manually.'); }
  };
  return (
    <Modal open={!!creds} title="Share these sign-in details" onClose={onClose}>
      {creds && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Give these to <strong>{creds.name}</strong> privately. For security, the password will not be shown again.</p>
          <dl className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
            <div><dt className="text-slate-500">Login</dt><dd className="select-all font-mono font-semibold text-slate-900">{creds.loginId}</dd></div>
            <div><dt className="text-slate-500">Password</dt><dd className="select-all font-mono font-semibold text-slate-900">{creds.password}</dd></div>
          </dl>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => void copy()}><Copy className="h-4 w-4" aria-hidden /> Copy</Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
