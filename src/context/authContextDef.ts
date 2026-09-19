import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, UserRole, SignUpParams, SignInParams, AuthResponse } from '../types/auth';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  signIn: (params: SignInParams) => Promise<AuthResponse>;
  signUp: (params: SignUpParams) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
