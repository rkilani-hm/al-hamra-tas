// Module M0.1 — Identity & Access: org-scope editor.
// Cascading Entity -> Branch -> Department selects + cross-dept read-only toggle.
// Uses shadcn Sheet (side honors RTL via dir on AppShell) + Select + Switch.

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/use-language";
import type {
  SetScopeInput,
  TasBranch,
  TasDepartment,
  TasEntity,
  UserWithAccess,
} from "../types";

interface ScopeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithAccess | null;
  entities: TasEntity[];
  branches: TasBranch[];
  departments: TasDepartment[];
  onSave: (input: SetScopeInput) => void;
  saving?: boolean;
}

export function ScopeDrawer({
  open,
  onOpenChange,
  user,
  entities,
  branches,
  departments,
  onSave,
  saving,
}: ScopeDrawerProps) {
  const { t } = useTranslation();
  const { language, direction } = useLanguage();

  const [entityId, setEntityId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [crossDeptReadonly, setCrossDeptReadonly] = useState(false);

  // Reset the form whenever the drawer opens for a (possibly different) user.
  useEffect(() => {
    if (open) {
      setEntityId(null);
      setBranchId(null);
      setDepartmentId(null);
      setCrossDeptReadonly(false);
    }
  }, [open, user?.id]);

  const name = (o: { name_en: string; name_ar: string }) =>
    language === "ar" ? o.name_ar : o.name_en;

  // Cascade: branches under the chosen entity, departments under the chosen branch.
  const availableBranches = useMemo(
    () => (entityId ? branches.filter((b) => b.entity_id === entityId) : []),
    [branches, entityId],
  );
  const availableDepartments = useMemo(
    () => (branchId ? departments.filter((d) => d.branch_id === branchId) : []),
    [departments, branchId],
  );

  const canSave = Boolean(user && entityId) && !saving;

  const handleSave = () => {
    if (!user || !entityId) return;
    onSave({
      user_id: user.id,
      entity_id: entityId,
      branch_id: branchId,
      department_id: departmentId,
      is_crossdept_readonly: crossDeptReadonly,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={direction === "rtl" ? "left" : "right"}
        className="flex w-full flex-col gap-6 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{t("identity.scope.title")}</SheetTitle>
          <SheetDescription>
            {user
              ? t("identity.scope.subtitle", {
                  name:
                    (language === "ar"
                      ? user.display_name_ar
                      : user.display_name_en) || user.email,
                })
              : t("identity.scope.subtitleEmpty")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4">
          {/* Entity */}
          <div className="flex flex-col gap-2">
            <Label>{t("identity.scope.entity")}</Label>
            <Select
              value={entityId ?? undefined}
              onValueChange={(v) => {
                setEntityId(v);
                setBranchId(null);
                setDepartmentId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("identity.scope.entityPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {name(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Branch (optional) */}
          <div className="flex flex-col gap-2">
            <Label>{t("identity.scope.branch")}</Label>
            <Select
              value={branchId ?? undefined}
              onValueChange={(v) => {
                setBranchId(v);
                setDepartmentId(null);
              }}
              disabled={!entityId || availableBranches.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("identity.scope.branchPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {name(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department (optional) */}
          <div className="flex flex-col gap-2">
            <Label>{t("identity.scope.department")}</Label>
            <Select
              value={departmentId ?? undefined}
              onValueChange={setDepartmentId}
              disabled={!branchId || availableDepartments.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("identity.scope.departmentPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {name(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cross-department read-only */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="flex flex-col gap-1 pe-4">
              <Label htmlFor="crossdept">{t("identity.scope.crossDept")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("identity.scope.crossDeptHint")}
              </span>
            </div>
            <Switch
              id="crossdept"
              checked={crossDeptReadonly}
              onCheckedChange={setCrossDeptReadonly}
            />
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("identity.buttons.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {t("identity.buttons.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
