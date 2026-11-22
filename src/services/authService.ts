import { supabase, STUDENT_EMAIL_DOMAIN } from '@/lib/supabase';
import type { Profile } from '@/types';

/** Students type a registration number; staff type an email. */
export function identifierToEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase();
  return value.includes('@') ? value : `${value.replace(/[^a-z0-9._-]/g, '')}@${STUDENT_EMAIL_DOMAIN}`;
}

export async function signIn(identifier: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email: identifierToEmail(identifier),
    password,
  });
  if (error) {
    // Do not reveal whether the account exists.
    if (error.status === 400) throw new Error('The ID or password is incorrect.');
    throw new Error('Could not sign in. Check your connection and try again.');
  }
}

export const signOut = () => supabase.auth.signOut();

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, school_id, role, full_name, email, registration_number, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error('Could not send the reset link. Try again shortly.');
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** Re-checks the current password before allowing a change. */
export async function verifyPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Your current password is incorrect.');
}
