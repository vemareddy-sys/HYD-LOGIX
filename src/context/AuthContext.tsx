import React, { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, isProduction, configError } from '../config/supabase';
import type { UserProfile, UserRole, SignUpParams, SignInParams, AuthResponse } from '../types/auth';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Authoritative profile retrieval from Supabase database with retry backoff for trigger replication
  const fetchProfileWithRetry = useCallback(async (userId: string, maxRetries = 3): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured) {
      if (isProduction) {
        throw new Error('Supabase configuration missing in production build.');
      }
      const mockProfile: UserProfile = {
        id: userId,
        email: 'operator@hyd-logix.internal',
        full_name: 'HYD Dev Operator',
        role: 'CONTROL_CENTER',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return mockProfile;
    }

    let delay = 200;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, created_at, updated_at')
          .eq('id', userId)
          .maybeSingle();

        if (profileErr) {
          console.warn(`[HYD-LOGIX] Profile query attempt ${attempt} warning:`, profileErr.message);
        } else if (data && (data.role === 'CONTROL_CENTER' || data.role === 'DRIVER')) {
          return data as UserProfile;
        }

        if (attempt < maxRetries) {
          await wait(delay);
          delay *= 2;
        }
      } catch (err: unknown) {
        console.warn(`[HYD-LOGIX] Profile query exception on attempt ${attempt}:`, err);
        if (attempt < maxRetries) {
          await wait(delay);
          delay *= 2;
        }
      }
    }

    console.warn(`[HYD-LOGIX] Profile not found in database for user ${userId} after ${maxRetries} attempts.`);
    return null;
  }, []);

  useEffect(() => {
    let active = true;

    // Safety timer: Guarantee loading state resolves even under extreme network latency
    const safetyTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, 3000);

    // Initial session load
    async function loadInitialSession() {
      if (configError) {
        if (active) {
          setError(configError);
          setLoading(false);
        }
        return;
      }

      if (!isSupabaseConfigured) {
        if (isProduction) {
          if (active) {
            setError('Fatal: Production deployment requires valid Supabase credentials.');
            setLoading(false);
          }
          return;
        }

        // Dev-only fallback
        const savedMockSession = sessionStorage.getItem('hyd_logix_mock_session');
        if (savedMockSession) {
          try {
            const parsed = JSON.parse(savedMockSession);
            if (active) {
              setUser({ id: parsed.id, email: parsed.email } as User);
              setProfile(parsed);
            }
          } catch {
            sessionStorage.removeItem('hyd_logix_mock_session');
          }
        }
        if (active) {
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (active) {
          if (session?.user) {
            setUser(session.user);
            const userProfile = await fetchProfileWithRetry(session.user.id, 2);
            if (active) {
              setProfile(userProfile);
            }
          } else {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Session initialization error';
          console.error('[HYD-LOGIX]', msg);
          setError(msg);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialSession();

    if (!isSupabaseConfigured) {
      return () => {
        active = false;
        clearTimeout(safetyTimer);
      };
    }

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const userProfile = await fetchProfileWithRetry(session.user.id, 3);
        if (active) setProfile(userProfile);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      } else if (event === 'USER_UPDATED' && session?.user) {
        setUser(session.user);
        const userProfile = await fetchProfileWithRetry(session.user.id, 2);
        if (active) setProfile(userProfile);
      }
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfileWithRetry]);

  const signIn = async ({ email, password }: SignInParams): Promise<AuthResponse> => {
    setError(null);

    if (configError) {
      return { success: false, error: configError };
    }

    if (!isSupabaseConfigured) {
      if (isProduction) {
        return { success: false, error: 'Live Supabase credentials are required in production.' };
      }
      const mockRole: UserRole = email.toLowerCase().includes('driver') ? 'DRIVER' : 'CONTROL_CENTER';
      const mockUser: UserProfile = {
        id: 'dev-' + Math.random().toString(36).substring(2, 9),
        email,
        full_name: email.split('@')[0].toUpperCase(),
        role: mockRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      sessionStorage.setItem('hyd_logix_mock_session', JSON.stringify(mockUser));
      setUser({ id: mockUser.id, email: mockUser.email } as User);
      setProfile(mockUser);
      return { success: true, role: mockRole };
    }

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        return { success: false, error: signInErr.message };
      }

      if (!data.user) {
        return { success: false, error: 'Authentication failed. User record not returned.' };
      }

      setUser(data.user);
      const userProfile = await fetchProfileWithRetry(data.user.id, 3);
      setProfile(userProfile);

      const resolvedRole = userProfile?.role || (data.user.user_metadata?.role as UserRole);
      if (!resolvedRole) {
        return { success: false, error: 'Account verified, but profile role could not be resolved from database.' };
      }

      return { success: true, role: resolvedRole };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during authentication';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const signUp = async ({ email, password, fullName, role }: SignUpParams): Promise<AuthResponse> => {
    setError(null);

    if (configError) {
      return { success: false, error: configError };
    }

    if (!role || (role !== 'CONTROL_CENTER' && role !== 'DRIVER')) {
      return { success: false, error: 'A valid operational role (CONTROL_CENTER or DRIVER) is strictly mandatory.' };
    }

    if (!isSupabaseConfigured) {
      if (isProduction) {
        return { success: false, error: 'Live Supabase credentials are required in production.' };
      }
      const mockUser: UserProfile = {
        id: 'dev-' + Math.random().toString(36).substring(2, 9),
        email,
        full_name: fullName,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      sessionStorage.setItem('hyd_logix_mock_session', JSON.stringify(mockUser));
      setUser({ id: mockUser.id, email: mockUser.email } as User);
      setProfile(mockUser);
      return { success: true, role };
    }

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: role,
          },
        },
      });

      if (signUpErr) {
        return { success: false, error: signUpErr.message };
      }

      if (data.user && !data.session) {
        return { 
          success: true, 
          role, 
          emailConfirmationRequired: true 
        };
      }

      if (data.user && data.session) {
        setUser(data.user);
        const userProfile = await fetchProfileWithRetry(data.user.id, 4);
        setProfile(userProfile || {
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        return { success: true, role, emailConfirmationRequired: false };
      }

      return { success: true, role };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error occurred during registration';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    sessionStorage.removeItem('hyd_logix_mock_session');
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfileWithRetry(user.id, 2);
      setProfile(p);
    }
  };

  const authoritativeRole: UserRole | null = profile?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: authoritativeRole,
        loading,
        error,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
