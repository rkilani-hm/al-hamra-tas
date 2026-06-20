// Route: /app/admin/users/:id — Module M0.1-admin-ui user detail (SYSTEM_ADMIN only).
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { UserDetail } from "@/features/admin/components/UserDetail";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/admin/users/$id")({
  head: () => ({ meta: [{ title: "User — Al Hamra TAS" }] }),
  component: AdminUserDetailPage,
});

function AdminUserDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/admin/users/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <RequireAdmin>
      <div className="space-y-4">
        <Link to="/app/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Chevron className="h-4 w-4" />
          {t("admin.backToList")}
        </Link>
        <UserDetail id={id} />
      </div>
    </RequireAdmin>
  );
}
