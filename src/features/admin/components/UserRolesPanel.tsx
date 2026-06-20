// Module M0.1-admin-ui — UserRolesPanel: assign/remove the seeded roles for a
// user. The last-admin guard error (cannot_remove_last_admin) surfaces friendly.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useLanguage } from "@/hooks/use-language";
import { adminAssignRole, adminErrorCode, adminListRoles, adminRemoveRole, safe } from "../api";
import type { AdminRole, AdminRoleRef } from "../types";

interface UserRolesPanelProps {
  userId: string;
  assignedRoles: AdminRoleRef[];
  onChanged: () => void;
}

export function UserRolesPanel({ userId, assignedRoles, onChanged }: UserRolesPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);

  const rolesQ = useQuery({ queryKey: ["admin", "roles"], queryFn: safe(adminListRoles) });
  const roles = rolesQ.data ?? [];
  const assigned = new Set(assignedRoles.map((r) => r.id));

  const roleName = (r: AdminRole) => (language === "ar" ? r.name_ar : r.name_en);

  const toggle = async (role: AdminRole, checked: boolean) => {
    setBusy(role.id);
    try {
      if (checked) await adminAssignRole(userId, role.id);
      else await adminRemoveRole(userId, role.id);
      toast.success(t("admin.toasts.rolesUpdated"));
      onChanged();
    } catch (err) {
      const code = adminErrorCode(err);
      toast.error(code ? t(`admin.errors.${code}`) : t("admin.errors.generic"));
    } finally {
      setBusy(null);
    }
  };

  if (rolesQ.isLoading) return <p className="text-sm text-muted-foreground">{t("admin.common.loading")}</p>;

  return (
    <ul className="space-y-1">
      {roles.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={assigned.has(r.id)}
              disabled={busy === r.id}
              onChange={(e) => toggle(r, e.target.checked)}
            />
            <span className="text-foreground">{roleName(r)}</span>
          </label>
          <span className="text-xs text-muted-foreground" dir="ltr">{r.code}</span>
        </li>
      ))}
    </ul>
  );
}
