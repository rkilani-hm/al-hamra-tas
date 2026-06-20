// Module M0.1-admin-ui — RequireAdmin: gates admin routes to SYSTEM_ADMIN.
// Defense in depth — the admin RPCs also reject non-admins server-side. Non-admins
// are redirected to /app with a toast. Renders inside /app (RequireAuth already ran).
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/AuthProvider";

export function isSystemAdmin(roles: { role_code: string }[]): boolean {
  return roles.some((r) => r.role_code === "SYSTEM_ADMIN");
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, roles } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const admin = isSystemAdmin(roles);

  useEffect(() => {
    if (loading) return;
    if (!admin) {
      toast.error(t("admin.errors.not_authorized"));
      void navigate({ to: "/app" });
    }
  }, [loading, admin, navigate, t]);

  if (loading || !admin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("admin.common.loading")}</p>
      </div>
    );
  }

  return <>{children}</>;
}
