import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">The page you opened does not exist or has moved.</p>
      <Link to="/" className="mt-6 font-semibold text-brand-700 hover:underline">Go to your dashboard</Link>
    </div>
  );
}
