import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Shared singleton to avoid duplicate admin checks across component instances
let cachedAdminStatus: { userId: string; isAdmin: boolean } | null = null;
let adminCheckPromise: Promise<boolean> | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const mountedRef = useRef(true);

  const checkAdminRole = useCallback(async (userId: string) => {
    // Use cached result if available for same user
    if (cachedAdminStatus && cachedAdminStatus.userId === userId) {
      setIsAdmin(cachedAdminStatus.isAdmin);
      return;
    }

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
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      // Set loading false immediately — don't wait for admin check
      setLoading(false);

      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
        cachedAdminStatus = null;
      }
    });

    supabase.auth.getSession();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [checkAdminRole]);

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

  return {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signOut,
  };
}
