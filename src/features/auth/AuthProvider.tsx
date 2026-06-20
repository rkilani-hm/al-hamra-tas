// Module M0.1-signin — AuthProvider / useAuth: the single source of truth for the
// authenticated session and the resolved tas_user (currentUserId). Tracks the
// Supabase session, resolves it to a tas_user server-side via resolve_current_user,
// and exposes roles/scopes + signIn/signOut app-wide.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import {
  currentUserRoles,
  currentUserScopes,
  resolveCurrentUser,
  signInWithSso,
  signOutSso,
} from "./api";
import { myCapabilities } from "@/features/permissions/api";
import type { CurrentUserRole, CurrentUserScope, TasUserResolution } from "./types";

interface AuthContextValue {
  session: Session | null;
  tasUser: TasUserResolution | null;
  currentUserId: string | null;
  roles: CurrentUserRole[];
  scopes: CurrentUserScope[];
  capabilities: string[];
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tasUser, setTasUser] = useState<TasUserResolution | null>(null);
  const [roles, setRoles] = useState<CurrentUserRole[]>([]);
  const [scopes, setScopes] = useState<CurrentUserScope[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve the tas_user + roles + scopes + capabilities for a present session.
  const resolve = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setTasUser(null);
      setRoles([]);
      setScopes([]);
      setCapabilities([]);
      setLoading(false);
      return;
    }
    try {
      const [user, r, s, caps] = await Promise.all([
        resolveCurrentUser(),
        currentUserRoles(),
        currentUserScopes(),
        myCapabilities().catch(() => [] as string[]),
      ]);
      setTasUser(user);
      setRoles(r);
      setScopes(s);
      setCapabilities(caps);
    } catch (err) {
      console.warn("[auth] identity resolution failed:", err);
      setTasUser(null);
      setRoles([]);
      setScopes([]);
      setCapabilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void resolve(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!active) return;
      setSession(sess);
      setLoading(true);
      void resolve(sess);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [resolve]);

  const signIn = useCallback(async () => {
    await signInWithSso();
  }, []);

  const signOut = useCallback(async () => {
    await signOutSso();
    setSession(null);
    setTasUser(null);
    setRoles([]);
    setScopes([]);
    setCapabilities([]);
  }, []);

  const value: AuthContextValue = {
    session,
    tasUser,
    currentUserId: tasUser?.id ?? null,
    roles,
    scopes,
    capabilities,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
