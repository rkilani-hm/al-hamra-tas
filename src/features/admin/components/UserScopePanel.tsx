// Module M0.1-admin-ui — UserScopePanel: assign/remove org scope (Entity required;
// Branch/Department optional for broader access). Reuses the M0.1/M0.2 org pickers.
// Scope semantics: entity-only = whole entity; +branch = that branch; +department
// = that department.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { listScopeBranches, listScopeDepartments, listScopeEntities } from "@/features/identity/api";
import { adminAssignScope, adminErrorCode, adminRemoveScope, safe } from "../api";
import type { AdminScope } from "../types";

const NONE = "none";

interface UserScopePanelProps {
  userId: string;
  scopes: AdminScope[];
  onChanged: () => void;
}

export function UserScopePanel({ userId, scopes, onChanged }: UserScopePanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [entityId, setEntityId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string>(NONE);
  const [departmentId, setDepartmentId] = useState<string>(NONE);
  const [busy, setBusy] = useState(false);

  const entitiesQ = useQuery({ queryKey: ["scope", "entities"], queryFn: safe(listScopeEntities) });
  const branchesQ = useQuery({ queryKey: ["scope", "branches"], queryFn: safe(listScopeBranches) });
  const departmentsQ = useQuery({ queryKey: ["scope", "departments"], queryFn: safe(listScopeDepartments) });

  const branches = useMemo(
    () => (branchesQ.data ?? []).filter((b) => b.entity_id === entityId),
    [branchesQ.data, entityId],
  );
  const departments = useMemo(
    () => (departmentsQ.data ?? []).filter((d) => branchId !== NONE && d.branch_id === branchId),
    [departmentsQ.data, branchId],
  );

  const loc = (en: string | null, ar: string | null) => (language === "ar" ? ar : en) || en || ar || "—";

  const onAdd = async () => {
    if (!entityId) return;
    setBusy(true);
    try {
      await adminAssignScope(
        userId,
        entityId,
        branchId === NONE ? null : branchId,
        departmentId === NONE ? null : departmentId,
      );
      toast.success(t("admin.toasts.scopeUpdated"));
      setEntityId(undefined); setBranchId(NONE); setDepartmentId(NONE);
      onChanged();
    } catch (err) {
      const code = adminErrorCode(err);
      toast.error(code ? t(`admin.errors.${code}`) : t("admin.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (scopeId: string) => {
    setBusy(true);
    try {
      await adminRemoveScope(scopeId);
      toast.success(t("admin.toasts.scopeUpdated"));
      onChanged();
    } catch (err) {
      const code = adminErrorCode(err);
      toast.error(code ? t(`admin.errors.${code}`) : t("admin.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  const scopeLabel = (s: AdminScope) => {
    const parts = [loc(s.entity_name_en, s.entity_name_ar)];
    if (s.branch_id) parts.push(loc(s.branch_name_en, s.branch_name_ar));
    if (s.department_id) parts.push(loc(s.department_name_en, s.department_name_ar));
    return parts.join(" › ");
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("admin.scope.help")}</p>

      {/* Existing scopes */}
      {scopes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.scope.none")}</p>
      ) : (
        <ul className="space-y-1">
          {scopes.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="text-foreground">{scopeLabel(s)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => onRemove(s.id)} aria-label={t("admin.actions.remove")}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Add scope */}
      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.scope.entity")}</Label>
          <Select value={entityId} onValueChange={(v) => { setEntityId(v); setBranchId(NONE); setDepartmentId(NONE); }}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("admin.scope.entity")} /></SelectTrigger>
            <SelectContent>
              {(entitiesQ.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{loc(e.name_en, e.name_ar)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.scope.branch")}</Label>
          <Select value={branchId} onValueChange={(v) => { setBranchId(v); setDepartmentId(NONE); }} disabled={!entityId}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("admin.scope.wholeEntity")}</SelectItem>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{loc(b.name_en, b.name_ar)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.scope.department")}</Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={branchId === NONE}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("admin.scope.wholeBranch")}</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{loc(d.name_en, d.name_ar)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-3">
          <Button size="sm" onClick={onAdd} disabled={busy || !entityId}>{t("admin.scope.add")}</Button>
        </div>
      </div>
    </div>
  );
}
