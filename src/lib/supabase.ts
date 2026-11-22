import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

// A placeholder URL keeps the app rendering so the setup banner can explain what is missing.
export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } },
);

export const STUDENT_EMAIL_DOMAIN =
  (import.meta.env.VITE_STUDENT_EMAIL_DOMAIN as string | undefined) ?? 'students.school.local';
