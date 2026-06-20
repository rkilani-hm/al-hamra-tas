// Route: /app/admin/permissions — Module M3.1-step2a permission catalog (read-only).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { PermissionCatalog } from "@/features/permissions/components/PermissionCatalog";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/admin/permissions")({
  head: () => ({ meta: [{ title: "Permission Catalog — Al Hamra TAS" }] }),
  component: CatalogPage,
});

function CatalogPage() {
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
          <h1 className="text-2xl font-semibold text-foreground">{t("permissions.page.catalogTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("permissions.page.catalogSubtitle")}</p>
        </div>
        <PermissionCatalog />
      </div>
    </RequireAdmin>
  );
}
