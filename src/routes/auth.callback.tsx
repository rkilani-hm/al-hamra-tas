// Route: /auth/callback — completes the Entra SAML SSO session. Supabase handles
// the token exchange; this route waits for the session to resolve, then routes to
// the app (resolved tas_user) or /no-access (unprovisioned) or /signin (no session).
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in — Al Hamra TAS" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const { t } = useTranslation();
  const { loading, session, tasUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/signin" });
    } else if (!tasUser) {
      void navigate({ to: "/no-access" });
    } else {
      void navigate({ to: "/app" });
    }
  }, [loading, session, tasUser, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{t("auth.signin.signingIn")}</p>
    </div>
  );
}
