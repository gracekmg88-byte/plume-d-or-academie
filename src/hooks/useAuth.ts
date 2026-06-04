import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth-audit";
import type { User, Session } from "@supabase/supabase-js";

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

// Per-user admin cache to avoid re-querying on every auth event (token refresh, etc.)
const adminCache = new Map<string, boolean>();

function useProvideAuth(): AuthContextValue {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecking, setAdminChecking] = useState(false);
  const mountedRef = useRef(true);
  const adminRequestIdRef = useRef(0);

  const checkAdminRole = useCallback(async (userId: string) => {
    // Use cached value if available — instant, no flicker on token refresh
    if (adminCache.has(userId)) {
      if (!mountedRef.current) return;
      setIsAdmin(adminCache.get(userId)!);
      setAdminChecking(false);
      return;
    }

    const requestId = ++adminRequestIdRef.current;
    setAdminChecking(true);

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      const result = !error && !!data;
      adminCache.set(userId, result);

      // Ignore stale responses if a newer auth event has fired
      if (!mountedRef.current || requestId !== adminRequestIdRef.current) return;
      setIsAdmin(result);
    } catch {
      if (!mountedRef.current || requestId !== adminRequestIdRef.current) return;
      setIsAdmin(false);
    } finally {
      if (mountedRef.current && requestId === adminRequestIdRef.current) {
        setAdminChecking(false);
      }
    }
  }, []);

  const applySession = useCallback((nextSession: Session | null) => {
    if (!mountedRef.current) return;

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      // Fire-and-forget — never await inside onAuthStateChange (Supabase deadlock risk)
      void checkAdminRole(nextSession.user.id);
    } else {
      adminRequestIdRef.current++; // cancel any in-flight check
      setIsAdmin(false);
      setAdminChecking(false);
    }
  }, [checkAdminRole]);

  useEffect(() => {
    mountedRef.current = true;

    // Standard Supabase pattern: subscribe FIRST, then getSession.
    // The subscription fires INITIAL_SESSION with the restored session, so we
    // don't need to gate it — let every event update state.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Log session lifecycle events for diagnostics
      const evt =
        event === "SIGNED_IN" ? "sign_in" :
        event === "SIGNED_OUT" ? "sign_out" :
        event === "TOKEN_REFRESHED" ? "token_refreshed" :
        event === "INITIAL_SESSION" ? (nextSession ? "session_restored" : "session_lost") :
        null;
      if (evt) {
        logAuthEvent(evt, {
          user_id: nextSession?.user?.id ?? null,
          email: nextSession?.user?.email ?? null,
          metadata: { supabase_event: event },
        });
      }
      applySession(nextSession);
      if (mountedRef.current) setAuthReady(true);
    });

    // Fallback in case INITIAL_SESSION doesn't fire (rare).
    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        if (!mountedRef.current) return;
        // Only apply if we haven't received an auth event yet
        applySession(restoredSession);
        setAuthReady(true);
      })
      .catch(() => {
        if (!mountedRef.current) return;
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

    // Pre-warm the admin check synchronously so the next render of any guarded
    // page already reflects the role — avoids "Accès non autorisé" flash.
    if (data.user) {
      adminCache.delete(data.user.id);
      await checkAdminRole(data.user.id);
    }

    return data;
  };

  const signOut = async () => {
    adminCache.clear();
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
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
