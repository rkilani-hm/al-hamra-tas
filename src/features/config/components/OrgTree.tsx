// Module M0.2 — Core Configuration: Entity → Branch → Department(→ sub-dept) tree.
// Read view + add/edit via the bilingual forms. RTL-safe (logical spacing).

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Building2, GitBranch, Plus, Pencil, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  createBranch,
  createDepartment,
  createEntity,
  listBranches,
  listDepartments,
  listEntities,
  safe,
  updateBranch,
  updateDepartment,
  updateEntity,
} from "../api";
import type { Branch, Department, Entity } from "../types";
import { EntityForm, type EntityFormValues } from "./EntityForm";
import { BranchForm, type BranchFormValues } from "./BranchForm";
import { DepartmentForm, type DepartmentFormValues } from "./DepartmentForm";

export function OrgTree() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("config.manage");
  const qc = useQueryClient();

  const entitiesQ = useQuery({ queryKey: ["config", "entities"], queryFn: safe(listEntities) });
  const branchesQ = useQuery({ queryKey: ["config", "branches"], queryFn: safe(() => listBranches()) });
  const departmentsQ = useQuery({
    queryKey: ["config", "departments"],
    queryFn: safe(() => listDepartments()),
  });

  const entities = entitiesQ.data ?? [];
  const branches = branchesQ.data ?? [];
  const departments = departmentsQ.data ?? [];

  const name = (o: { name_en: string; name_ar: string }) =>
    language === "ar" ? o.name_ar : o.name_en;

  // Form state
  const [entityForm, setEntityForm] = useState<{ open: boolean; initial: Entity | null }>({
    open: false,
    initial: null,
  });
  const [branchForm, setBranchForm] = useState<{
    open: boolean;
    entityId: string;
    initial: Branch | null;
  }>({ open: false, entityId: "", initial: null });
  const [deptForm, setDeptForm] = useState<{
    open: boolean;
    branchId: string;
    initial: Department | null;
  }>({ open: false, branchId: "", initial: null });
  const [saving, setSaving] = useState(false);

  const branchesByEntity = useMemo(() => {
    const m = new Map<string, Branch[]>();
    for (const b of branches) {
      const arr = m.get(b.entity_id) ?? [];
      arr.push(b);
      m.set(b.entity_id, arr);
    }
    return m;
  }, [branches]);

  const deptsByBranch = useMemo(() => {
    const m = new Map<string, Department[]>();
    for (const d of departments) {
      const arr = m.get(d.branch_id) ?? [];
      arr.push(d);
      m.set(d.branch_id, arr);
    }
    return m;
  }, [departments]);

  const invalidate = (key: string) =>
    qc.invalidateQueries({ queryKey: ["config", key] });

  // --- Save handlers --------------------------------------------------------
  const saveEntity = async (v: EntityFormValues) => {
    setSaving(true);
    try {
      if (entityForm.initial) await updateEntity(entityForm.initial.id, v);
      else await createEntity(v);
      toast.success(t("config.toasts.saved"));
      setEntityForm({ open: false, initial: null });
      await invalidate("entities");
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async (v: BranchFormValues) => {
    setSaving(true);
    try {
      if (branchForm.initial) await updateBranch(branchForm.initial.id, v);
      else await createBranch(v);
      toast.success(t("config.toasts.saved"));
      setBranchForm({ open: false, entityId: "", initial: null });
      await invalidate("branches");
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const saveDept = async (v: DepartmentFormValues) => {
    setSaving(true);
    try {
      if (deptForm.initial) await updateDepartment(deptForm.initial.id, v);
      else await createDepartment(v);
      toast.success(t("config.toasts.saved"));
      setDeptForm({ open: false, branchId: "", initial: null });
      await invalidate("departments");
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Render top-level departments first, with their children nested.
  const renderDepartments = (branchId: string) => {
    const all = deptsByBranch.get(branchId) ?? [];
    const roots = all.filter((d) => !d.parent_department_id);
    const childrenOf = (id: string) => all.filter((d) => d.parent_department_id === id);

    const row = (d: Department, depth: number) => (
      <div key={d.id} className="space-y-1">
        <div
          className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted/50"
          style={{ marginInlineStart: depth * 16 }}
        >
          <span className="flex items-center gap-2 text-sm">
            <Network className="h-3.5 w-3.5 text-muted-foreground" />
            {name(d)}
            <span className="text-xs text-muted-foreground">({d.code})</span>
          </span>
          {canWrite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("config.buttons.edit")}
              onClick={() => setDeptForm({ open: true, branchId, initial: d })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {childrenOf(d.id).map((c) => row(c, depth + 1))}
      </div>
    );

    return (
      <div className="space-y-1">
        {roots.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t("config.org.noDepartments")}
          </p>
        ) : (
          roots.map((d) => row(d, 0))
        )}
        {canWrite && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setDeptForm({ open: true, branchId, initial: null })}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("config.org.addDepartment")}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("config.org.title")}</h2>
        {canWrite && (
          <Button onClick={() => setEntityForm({ open: true, initial: null })} className="gap-1">
            <Plus className="h-4 w-4" />
            {t("config.org.addEntity")}
          </Button>
        )}
      </div>

      {entitiesQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("config.common.loading")}</p>
      ) : entities.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("config.org.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {entities.map((ent) => (
            <div key={ent.id} className="rounded-lg border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  {name(ent)}
                  <Badge variant="outline">{ent.code}</Badge>
                  {ent.kuwaitization_target_pct != null && (
                    <Badge variant="secondary">
                      {t("config.fields.kuwaitizationTarget")}: {ent.kuwaitization_target_pct}%
                    </Badge>
                  )}
                </span>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={t("config.buttons.edit")}
                      onClick={() => setEntityForm({ open: true, initial: ent })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => setBranchForm({ open: true, entityId: ent.id, initial: null })}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t("config.org.addBranch")}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-3">
                {(branchesByEntity.get(ent.id) ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("config.org.noBranches")}</p>
                ) : (
                  (branchesByEntity.get(ent.id) ?? []).map((br) => (
                    <div key={br.id} className="rounded-md border">
                      <div className="flex items-center justify-between bg-muted/20 px-2 py-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                          {name(br)}
                          <span className="text-xs text-muted-foreground">({br.code})</span>
                        </span>
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={t("config.buttons.edit")}
                            onClick={() => setBranchForm({ open: true, entityId: ent.id, initial: br })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="p-2">{renderDepartments(br.id)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Forms */}
      <EntityForm
        open={entityForm.open}
        onOpenChange={(o) => setEntityForm((s) => ({ ...s, open: o }))}
        initial={entityForm.initial}
        onSubmit={saveEntity}
        saving={saving}
      />
      <BranchForm
        open={branchForm.open}
        onOpenChange={(o) => setBranchForm((s) => ({ ...s, open: o }))}
        entityId={branchForm.entityId}
        initial={branchForm.initial}
        onSubmit={saveBranch}
        saving={saving}
      />
      <DepartmentForm
        open={deptForm.open}
        onOpenChange={(o) => setDeptForm((s) => ({ ...s, open: o }))}
        branchId={deptForm.branchId}
        parentOptions={deptsByBranch.get(deptForm.branchId) ?? []}
        initial={deptForm.initial}
        onSubmit={saveDept}
        saving={saving}
      />
    </div>
  );
}
