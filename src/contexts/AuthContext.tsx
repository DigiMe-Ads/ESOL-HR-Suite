import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/db/supabase';
import type { Profile, Permission } from '@/types/types';
import { getProfile } from '@/db/api';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** True once the loaded profile belongs to the signed-in user (false while switching accounts) */
  profileReady: boolean;
  /** True after arriving through an emailed "set your password" link */
  passwordRecovery: boolean;
  endPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasPermission: (module: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileReady: false,
  passwordRecovery: false,
  endPasswordRecovery: () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  hasPermission: () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFor, setProfileFor] = useState<string | null>(null);
  // Supabase strips the link token from the URL, so remember the recovery state on first load
  const [passwordRecovery, setPasswordRecovery] = useState(() => window.location.hash.includes('type=recovery'));

  const fetchProfile = useCallback(async (uid: string) => {
    const p = await getProfile(uid);
    setProfile(p);
    setProfileFor(uid);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setProfileFor(null); }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Admins always have every module; other roles check their granted permission list
  const hasPermission = useCallback((module: Permission): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return (profile.permissions ?? []).includes(module);
  }, [profile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setProfileFor(null);
    setPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileReady: !user || profileFor === user.id, passwordRecovery, endPasswordRecovery: () => setPasswordRecovery(false), signOut, refreshProfile, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
