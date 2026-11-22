import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchProfile, signIn as svcSignIn, signOut as svcSignOut } from '@/services/authService';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); setProfileError(null); return; }
    try {
      const p = await fetchProfile(s.user.id);
      if (!p || !p.is_active) {
        setProfile(null);
        setProfileError('Your account is not set up or has been deactivated. Contact your school administrator.');
      } else {
        setProfile(p);
        setProfileError(null);
      }
    } catch {
      setProfile(null);
      setProfileError('We could not load your profile. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (active) setLoading(false);
    }).catch(() => { if (active) setLoading(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Defer to avoid deadlocks inside the auth callback.
      setTimeout(() => { void loadProfile(next); }, 0);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const value = useMemo<AuthState>(() => ({
    session, profile, loading, profileError,
    signIn: svcSignIn,
    signOut: async () => { await svcSignOut(); },
    refreshProfile: () => loadProfile(session),
  }), [session, profile, loading, profileError, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
