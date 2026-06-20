// Module M0.1-admin-ui — UserDetail: composes the user record (edit), roles panel,
// scope panel, a read-only delegations view, and the reused M0.5 <AuditTrail>.
// Status activate/deactivate is guarded server-side (last-admin lockout).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import { adminErrorCode, adminGetUser, adminSetUserStatus } from "../api";
import { UserForm } from "./UserForm";
import { UserRolesPanel } from "./UserRolesPanel";
import { UserScopePanel } from "./UserScopePanel";

interface UserDetailProps {
  id: string;
}

export function UserDetail({ id }: UserDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["admin", "user", id], queryFn: () => adminGetUser(id) });
  const data = q.data;
  const user = data?.user ?? null;
  const roles = data?.roles ?? [];
  const scopes = data?.scopes ?? [];
  const delegations = data?.delegations ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "user", id] });

  const name = user
    ? (language === "ar" ? user.display_name_ar : user.display_name_en) || user.display_name_en || user.email
    : "";

  const onToggleStatus = async () => {
    if (!user) return;
    const next = user.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await adminSetUserStatus(id, next);
      toast.success(t("admin.toasts.userSaved"));
      refresh();
    } catch (err) {
      const code = adminErrorCode(err);
      toast.error(code ? t(`admin.errors.${code}`) : t("admin.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("admin.common.loading")}</p>;
  if (!user) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("admin.detail.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
          <Badge variant={user.status === "active" ? "default" : "secondary"}>{t(`admin.status.${user.status}`)}</Badge>
          <span className="text-sm text-muted-foreground" dir="ltr">{user.email}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>{t("admin.actions.edit")}</Button>}
          <Button variant={user.status === "active" ? "destructive" : "default"} onClick={onToggleStatus} disabled={busy}>
            {user.status === "active" ? t("admin.actions.deactivate") : t("admin.actions.activate")}
          </Button>
        </div>
      </header>

      {/* Edit form */}
      {editing && (
        <UserForm user={user} onSaved={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} />
      )}

      {/* Roles + scope */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("admin.detail.roles")}</h3>
          <UserRolesPanel userId={id} assignedRoles={roles} onChanged={refresh} />
        </section>
        <section className="space-y-2 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("admin.detail.scope")}</h3>
          <UserScopePanel userId={id} scopes={scopes} onChanged={refresh} />
        </section>
      </div>

      {/* Delegations (read-only) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("admin.detail.delegations")}</h3>
        {delegations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.detail.noDelegations")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {delegations.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{d.type}</Badge>
                <Badge variant="secondary">{d.status}</Badge>
                <span className="text-xs text-muted-foreground" dir="ltr">{d.start_date ?? "—"} → {d.end_date ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Audit trail (reused M0.5) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("admin.detail.audit")}</h3>
        <AuditTrail entityType="user" entityRef={id} />
      </section>
    </div>
  );
}
