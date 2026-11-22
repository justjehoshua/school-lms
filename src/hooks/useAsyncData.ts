import { useCallback, useEffect, useState } from 'react';
import { friendlyError } from '@/lib/errors';

/** `loader` must be a stable reference (module-level function or useCallback). */
export function useAsyncData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setData(await loader()); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, [loader]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}
