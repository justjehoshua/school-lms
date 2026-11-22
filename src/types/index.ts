export type UserRole = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  school_id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  registration_number: string | null;
  is_active: boolean;
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};
