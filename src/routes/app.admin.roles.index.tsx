// Route: /app/admin/roles — Module M3.1-step2a role list (SYSTEM_ADMIN only).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ShieldCheck, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { RoleList } from "@/features/permissions/components/RoleList";

export const Route = createFileRoute("/app/admin/roles/")({
  head: () => ({
    meta: [
      { title: "Roles & Permissions — Al Hamra TAS" },
      { name: "description", content: "Manage roles and their permission grants." },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { t } = useTranslation();
  return (
    <RequireAdmin>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{t("permissions.page.rolesTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("permissions.page.rolesSubtitle")}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/app/admin/permissions"><KeyRound className="h-4 w-4" /> {t("permissions.nav.catalog")}</Link>
          </Button>
        </header>
        <RoleList />
      </div>
    </RequireAdmin>
  );
}
