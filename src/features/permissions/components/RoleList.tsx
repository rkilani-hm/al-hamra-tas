// Module M3.1-step2a — RoleList: list/create/edit/delete roles. Delete blocked for
// system roles and in-use roles (friendly guard errors). Links to the matrix.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Grid3x3, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { permissionErrorCode, roleDelete, rolepermListMatrix } from "../api";
import type { MatrixRole } from "../types";
import { RoleForm } from "./RoleForm";

export function RoleList() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [form, setForm] = useState<{ open: boolean; role: MatrixRole | null }>({ open: false, role: null });
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["permissions", "matrix"], queryFn: rolepermListMatrix });
  const roles = q.data?.roles ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["permissions", "matrix"] });

  const name = (r: MatrixRole) => (language === "ar" ? r.name_ar : r.name_en) || r.name_en || r.code;

  const onDelete = async (r: MatrixRole) => {
    setBusy(true);
    try {
      await roleDelete(r.id);
      toast.success(t("permissions.toasts.roleDeleted"));
      refresh();
    } catch (err) {
      const c = permissionErrorCode(err);
      toast.error(c ? t(`permissions.errors.${c}`) : t("permissions.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/app/admin/roles/matrix"><Grid3x3 className="h-4 w-4" /> {t("permissions.nav.matrix")}</Link>
        </Button>
        {!form.open && (
          <Button size="sm" className="gap-1" onClick={() => setForm({ open: true, role: null })}>
            <Plus className="h-4 w-4" /> {t("permissions.actions.newRole")}
          </Button>
        )}
      </div>

      {form.open && (
        <RoleForm
          role={form.role}
          onSaved={() => { setForm({ open: false, role: null }); refresh(); }}
          onCancel={() => setForm({ open: false, role: null })}
        />
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("permissions.common.loading")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {name(r)}
                  <Badge variant="outline" dir="ltr" className="font-mono text-xs">{r.code}</Badge>
                  {r.is_system && <Badge variant="secondary" className="text-xs">{t("permissions.role.system")}</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{t("permissions.role.userCount", { count: r.user_count })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("permissions.actions.edit")} onClick={() => setForm({ open: true, role: r })}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!r.is_system && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("permissions.actions.delete")} disabled={busy} onClick={() => onDelete(r)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
