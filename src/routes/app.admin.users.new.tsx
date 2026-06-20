// Route: /app/admin/users/new — Module M0.1-admin-ui create user (SYSTEM_ADMIN only).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { UserForm } from "@/features/admin/components/UserForm";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/admin/users/new")({
  head: () => ({ meta: [{ title: "New User — Al Hamra TAS" }] }),
  component: NewUserPage,
});

function NewUserPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const navigate = useNavigate();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <RequireAdmin>
      <div className="space-y-4">
        <Link to="/app/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Chevron className="h-4 w-4" />
          {t("admin.backToList")}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">{t("admin.actions.newUser")}</h1>
        <UserForm onSaved={(id) => navigate({ to: "/app/admin/users/$id", params: { id } })} />
      </div>
    </RequireAdmin>
  );
}
