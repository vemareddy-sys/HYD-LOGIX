export type UserRole = 'CONTROL_CENTER' | 'DRIVER';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: any | null; // Supabase User
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  role?: UserRole;
  error?: string;
  emailConfirmationRequired?: boolean;
}
