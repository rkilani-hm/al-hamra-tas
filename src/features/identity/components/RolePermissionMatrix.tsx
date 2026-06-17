// Module M0.1 — Identity & Access: role/permission matrix.
// Rows = modules, columns = actions, checkboxes mark which permissions a role has.
// Read-only by default in M0.1 (editing role grants is hardened in M3.1).

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import type { PermissionAction, TasPermission, TasRole } from "../types";

const ACTION_ORDER: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "approve",
  "delete",
  "export",
];

interface RolePermissionMatrixProps {
  roles: TasRole[];
  permissions: TasPermission[];
  rolePermissions: { role_id: string; permission_id: string }[];
  selectedRoleId: string | null;
  onSelectRole: (roleId: string) => void;
  // When provided, cells become interactive (reserved for M3.1).
  onToggle?: (permissionId: string, next: boolean) => void;
}

export function RolePermissionMatrix({
  roles,
  permissions,
  rolePermissions,
  selectedRoleId,
  onSelectRole,
  onToggle,
}: RolePermissionMatrixProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  // Distinct module codes (rows).
  const modules = useMemo(
    () => Array.from(new Set(permissions.map((p) => p.module_code))).sort(),
    [permissions],
  );

  // Lookup: `${module}|${action}` -> permission id.
  const permByCell = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of permissions) map.set(`${p.module_code}|${p.action}`, p.id);
    return map;
  }, [permissions]);

  // Set of permission ids granted to the selected role.
  const grantedIds = useMemo(() => {
    if (!selectedRoleId) return new Set<string>();
    return new Set(
      rolePermissions
        .filter((rp) => rp.role_id === selectedRoleId)
        .map((rp) => rp.permission_id),
    );
  }, [rolePermissions, selectedRoleId]);

  const roleName = (r: TasRole) => (language === "ar" ? r.name_ar : r.name_en);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <label className="text-sm font-medium text-foreground">
          {t("identity.matrix.selectRole")}
        </label>
        <Select value={selectedRoleId ?? undefined} onValueChange={onSelectRole}>
          <SelectTrigger>
            <SelectValue placeholder={t("identity.matrix.selectRolePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {roleName(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("identity.matrix.module")}</TableHead>
              {ACTION_ORDER.map((a) => (
                <TableHead key={a} className="text-center">
                  {t(`identity.matrix.actions.${a}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={ACTION_ORDER.length + 1}
                  className="h-20 text-center text-muted-foreground"
                >
                  {t("identity.matrix.empty")}
                </TableCell>
              </TableRow>
            ) : (
              modules.map((moduleCode) => (
                <TableRow key={moduleCode}>
                  <TableCell className="font-medium text-foreground">
                    {moduleCode}
                  </TableCell>
                  {ACTION_ORDER.map((action) => {
                    const permId = permByCell.get(`${moduleCode}|${action}`);
                    const exists = Boolean(permId);
                    const checked = permId ? grantedIds.has(permId) : false;
                    return (
                      <TableCell key={action} className="text-center">
                        {exists ? (
                          <div className="flex justify-center">
                            <Checkbox
                              checked={checked}
                              disabled={!onToggle || !selectedRoleId}
                              onCheckedChange={(v) =>
                                permId && onToggle?.(permId, Boolean(v))
                              }
                              aria-label={`${moduleCode} ${action}`}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
