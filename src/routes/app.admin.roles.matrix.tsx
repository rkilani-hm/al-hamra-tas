// Route: /app/admin/roles/matrix — Module M3.1-step2a role×permission grid.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { RolePermissionMatrix } from "@/features/permissions/components/RolePermissionMatrix";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/admin/roles/matrix")({
  head: () => ({ meta: [{ title: "Role Permissions — Al Hamra TAS" }] }),
  component: MatrixPage,
});

function MatrixPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  return (
    <RequireAdmin>
      <div className="space-y-4">
        <Link to="/app/admin/roles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Chevron className="h-4 w-4" />
          {t("permissions.backToRoles")}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("permissions.page.matrixTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("permissions.page.matrixSubtitle")}</p>
        </div>
        <RolePermissionMatrix />
      </div>
    </RequireAdmin>
  );
}
