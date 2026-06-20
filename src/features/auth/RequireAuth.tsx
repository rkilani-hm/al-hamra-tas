// Module M0.1-signin — RequireAuth: gate for /app/* routes.
//   * loading            -> loading screen (no premature flash of /signin or /no-access)
//   * no session         -> redirect to /signin
//   * session, no tasUser -> redirect to /no-access (unprovisioned)
//   * session + tasUser   -> render the app
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "./AuthProvider";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, tasUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/signin" });
    } else if (!tasUser) {
      void navigate({ to: "/no-access" });
    }
  }, [loading, session, tasUser, navigate]);

  if (loading || !session || !tasUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("auth.loading")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
