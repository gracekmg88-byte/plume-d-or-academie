import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Shared singleton to avoid duplicate admin checks across component instances
let cachedAdminStatus: { userId: string; isAdmin: boolean } | null = null;
let adminCheckPromise: Promise<boolean> | null = null;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authReady: boolean;
  isAdmin: boolean;
  adminChecking: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  const checkAdminRole = useCallback(async (userId: string) => {
    // Use cached result if available for same user — instant, no flicker
    if (cachedAdminStatus && cachedAdminStatus.userId === userId) {
      setIsAdmin(cachedAdminStatus.isAdmin);
      setAdminChecking(false);
      return;
    }

    setAdminChecking(true);

    // Deduplicate concurrent requests
    if (!adminCheckPromise) {
      adminCheckPromise = (async () => {
        try {
          const { data, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "admin")
            .maybeSingle();

          const result = !error && !!data;
          cachedAdminStatus = { userId, isAdmin: result };
          return result;
        } catch {
          cachedAdminStatus = { userId, isAdmin: false };
          return false;
        } finally {
          adminCheckPromise = null;
        }
      })();
    }

    const result = await adminCheckPromise;
    if (mountedRef.current) {
      setIsAdmin(result);
      setAdminChecking(false);
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    if (!mountedRef.current) return;

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      void checkAdminRole(nextSession.user.id);
      return;
    }

    setIsAdmin(false);
    setAdminChecking(false);
    cachedAdminStatus = null;
  }, [checkAdminRole]);

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mountedRef.current) return;

      applySession(nextSession);

      if (initializedRef.current) {
        setAuthReady(true);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        if (!mountedRef.current) return;
        applySession(restoredSession);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        applySession(null);
      })
      .finally(() => {
        if (!mountedRef.current) return;
        initializedRef.current = true;
        setAuthReady(true);
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    cachedAdminStatus = null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const effectiveLoading = !authReady || (!!user && adminChecking);

  return useMemo(
    () => ({
      user,
      session,
      loading: effectiveLoading,
      authReady,
      isAdmin,
      adminChecking,
      signIn,
      signOut,
    }),
    [user, session, effectiveLoading, authReady, isAdmin, adminChecking],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useProvideAuth();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
