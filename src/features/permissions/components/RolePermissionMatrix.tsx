// Module M3.1-step2a — RolePermissionMatrix: roles × permissions grid. Toggling a
// cell grants/revokes. SYSTEM_ADMIN's core admin perms (user.admin/config.manage)
// are locked-on (checked + disabled). cannot_revoke_core_admin surfaced friendly.
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { permissionErrorCode, rolepermGrant, rolepermListMatrix, rolepermRevoke } from "../api";
import { CORE_ADMIN_KEYS, type MatrixPermission, type MatrixRole } from "../types";

export function RolePermissionMatrix() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [busyCell, setBusyCell] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["permissions", "matrix"], queryFn: rolepermListMatrix });
  const roles = q.data?.roles ?? [];
  const permissions = q.data?.permissions ?? [];
  const grants = q.data?.grants ?? [];

  const grantSet = useMemo(
    () => new Set(grants.map((g) => `${g.role_id}|${g.permission_id}`)),
    [grants],
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["permissions", "matrix"] });

  const roleName = (r: MatrixRole) => (language === "ar" ? r.name_ar : r.name_en) || r.code;
  const permName = (p: MatrixPermission) => (language === "ar" ? p.name_ar : p.name_en);

  // Permissions grouped by area for readable row sections.
  const byArea = useMemo(() => {
    const m = new Map<string, MatrixPermission[]>();
    for (const p of permissions) {
      const arr = m.get(p.area) ?? [];
      arr.push(p);
      m.set(p.area, arr);
    }
    return [...m.entries()];
  }, [permissions]);

  const isLocked = (role: MatrixRole, perm: MatrixPermission) =>
    role.code === "SYSTEM_ADMIN" && (CORE_ADMIN_KEYS as readonly string[]).includes(perm.key);

  const toggle = async (role: MatrixRole, perm: MatrixPermission) => {
    if (isLocked(role, perm)) {
      toast.info(t("permissions.matrix.locked"));
      return;
    }
    const cell = `${role.id}|${perm.id}`;
    const granted = grantSet.has(cell);
    setBusyCell(cell);
    try {
      if (granted) await rolepermRevoke(role.id, perm.id);
      else await rolepermGrant(role.id, perm.id);
      refresh();
    } catch (err) {
      const c = permissionErrorCode(err);
      toast.error(c ? t(`permissions.errors.${c}`) : t("permissions.errors.generic"));
    } finally {
      setBusyCell(null);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("permissions.common.loading")}</p>;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky inline-start-0 z-10 bg-muted/40 p-2 text-start font-medium">{t("permissions.matrix.permission")}</th>
            {roles.map((r) => (
              <th key={r.id} className="p-2 text-center font-medium">
                <span className="flex flex-col items-center gap-1">
                  <span className="text-xs">{roleName(r)}</span>
                  {r.is_system && <Badge variant="secondary" className="text-[10px]">{t("permissions.role.system")}</Badge>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {byArea.map(([area, list]) => (
            <Fragment key={area}>
              <tr className="border-b bg-muted/20">
                <td colSpan={roles.length + 1} className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`permissions.area.${area}`)}
                </td>
              </tr>
              {list.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-2">
                    <span className="block text-foreground">{permName(p)}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground" dir="ltr">{p.key}</span>
                  </td>
                  {roles.map((r) => {
                    const cell = `${r.id}|${p.id}`;
                    const locked = isLocked(r, p);
                    const checked = locked || grantSet.has(cell);
                    return (
                      <td key={r.id} className="p-2 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          disabled={locked || busyCell === cell}
                          onChange={() => toggle(r, p)}
                          aria-label={`${r.code} ${p.key}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
