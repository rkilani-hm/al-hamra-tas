// Route: /app/admin/users — Module M0.1-admin-ui user list (SYSTEM_ADMIN only).
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserCog } from "lucide-react";

import { RequireAdmin } from "@/features/admin/RequireAdmin";
import { UserList } from "@/features/admin/components/UserList";

export const Route = createFileRoute("/app/admin/users/")({
  head: () => ({
    meta: [
      { title: "User Administration — Al Hamra TAS" },
      { name: "description", content: "Provision and manage TAS users, roles, and scope." },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { t } = useTranslation();
  return (
    <RequireAdmin>
      <div className="space-y-6">
        <header className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("admin.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("admin.page.subtitle")}</p>
          </div>
        </header>
        <UserList />
      </div>
    </RequireAdmin>
  );
}
