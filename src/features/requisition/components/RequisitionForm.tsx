// Module M1.2 — requisition create form.
// Org cascade (M0.2) → Position (job catalog, suggests JD template) → JD
// (bilingual, editable into the snapshot) → Details (lookups) → Budgeted
// indicator (warn-only) → Justification (EN, internal). Save draft / Submit.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  listBranches,
  listDepartments,
  listEntities,
  listJobPositions,
  listJdTemplates,
  listLookups,
  safe as configSafe,
} from "@/features/config/api";
import {
  checkBudgetedPosition,
  createDraftRequisition,
  submitRequisition,
} from "../api";
import type { BudgetedCheck, RequisitionDraftInput } from "../types";

interface RequisitionFormProps {
  currentUserId?: string | null;
}

export function RequisitionForm({ currentUserId = null }: RequisitionFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWriteReq = capabilities.includes("requisition.write");
  const canSubmitReq = capabilities.includes("requisition.submit");
  const navigate = useNavigate();

  // Reference data (existing M0.x tables, strict client via config API).
  const entitiesQ = useQuery({ queryKey: ["requisition", "entities"], queryFn: configSafe(listEntities) });
  const branchesQ = useQuery({ queryKey: ["requisition", "branches"], queryFn: configSafe(() => listBranches()) });
  const departmentsQ = useQuery({ queryKey: ["requisition", "departments"], queryFn: configSafe(() => listDepartments()) });
  const positionsQ = useQuery({ queryKey: ["requisition", "positions"], queryFn: configSafe(listJobPositions) });
  const templatesQ = useQuery({ queryKey: ["requisition", "templates"], queryFn: configSafe(listJdTemplates) });
  const empTypesQ = useQuery({ queryKey: ["requisition", "lk", "employment_type"], queryFn: configSafe(() => listLookups("employment_type")) });
  const contractTypesQ = useQuery({ queryKey: ["requisition", "lk", "contract_type"], queryFn: configSafe(() => listLookups("contract_type")) });

  const entities = entitiesQ.data ?? [];
  const branches = branchesQ.data ?? [];
  const departments = departmentsQ.data ?? [];
  const positions = positionsQ.data ?? [];
  const templates = templatesQ.data ?? [];
  const empTypes = empTypesQ.data ?? [];
  const contractTypes = contractTypesQ.data ?? [];

  const name = (o: { name_en: string; name_ar: string }) => (language === "ar" ? o.name_ar : o.name_en);
  const lkName = (o: { name_en: string; name_ar: string }) => (language === "ar" ? o.name_ar : o.name_en);

  // Form state
  const [entityId, setEntityId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [jdTemplateId, setJdTemplateId] = useState<string | null>(null);
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [employmentType, setEmploymentType] = useState("");
  const [contractType, setContractType] = useState("");
  const [targetStart, setTargetStart] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [justification, setJustification] = useState("");
  const [budget, setBudget] = useState<BudgetedCheck | null>(null);
  const [saving, setSaving] = useState(false);

  // Cascade filters
  const availableBranches = useMemo(
    () => (entityId ? branches.filter((b) => b.entity_id === entityId) : []),
    [branches, entityId],
  );
  const availableDepartments = useMemo(
    () => (branchId ? departments.filter((d) => d.branch_id === branchId) : []),
    [departments, branchId],
  );

  // On position select, suggest a matching JD template + prefill titles.
  const onPositionChange = (id: string) => {
    setPositionId(id);
    const tpl = templates.find((x) => x.job_position_id === id && x.status === "active")
      ?? templates.find((x) => x.job_position_id === id);
    if (tpl) {
      setJdTemplateId(tpl.id);
      if (!titleEn) setTitleEn(tpl.title_en);
      if (!titleAr) setTitleAr(tpl.title_ar);
      if (!summaryEn) setSummaryEn(tpl.summary_en ?? "");
      if (!summaryAr) setSummaryAr(tpl.summary_ar ?? "");
    } else {
      setJdTemplateId(null);
    }
  };

  // Budgeted indicator — recheck when position/department/headcount change.
  useEffect(() => {
    let cancelled = false;
    if (!positionId) {
      setBudget(null);
      return;
    }
    void checkBudgetedPosition(positionId, departmentId || null, Number(headcount) || 1)
      .then((b) => {
        if (!cancelled) setBudget(b);
      })
      .catch(() => {
        if (!cancelled) setBudget(null);
      });
    return () => {
      cancelled = true;
    };
  }, [positionId, departmentId, headcount]);

  const buildInput = (): RequisitionDraftInput => ({
    title_en: titleEn.trim() || null,
    title_ar: titleAr.trim() || null,
    job_position_id: positionId,
    jd_template_id: jdTemplateId,
    jd_snapshot_json: {
      manual: !jdTemplateId,
      summary_en: summaryEn.trim() || null,
      summary_ar: summaryAr.trim() || null,
    },
    entity_id: entityId,
    branch_id: branchId || null,
    department_id: departmentId || null,
    headcount: Number(headcount) || 1,
    employment_type: employmentType || null,
    contract_type: contractType || null,
    target_start_date: targetStart || null,
    salary_min: salaryMin ? Number(salaryMin) : null,
    salary_max: salaryMax ? Number(salaryMax) : null,
    justification_en: justification.trim() || null,
    requested_by: currentUserId,
  });

  const valid = Boolean(entityId && positionId && (titleEn.trim() || titleAr.trim()) && (Number(headcount) || 0) >= 1);

  const saveDraft = async (): Promise<string | null> => {
    if (!valid) {
      toast.error(t("requisition.validation.required"));
      return null;
    }
    try {
      const rec = await createDraftRequisition(buildInput());
      return rec.id;
    } catch {
      toast.error(t("requisition.toasts.saveError"));
      return null;
    }
  };

  const onSaveDraft = async () => {
    setSaving(true);
    const id = await saveDraft();
    setSaving(false);
    if (id) {
      toast.success(t("requisition.toasts.draftSaved"));
      navigate({ to: "/app/requisitions/$id", params: { id } });
    }
  };

  const onSubmit = async () => {
    setSaving(true);
    const id = await saveDraft();
    if (id) {
      try {
        await submitRequisition(id);
        toast.success(t("requisition.toasts.submitted"));
      } catch {
        toast.error(t("requisition.toasts.submitError"));
      }
      navigate({ to: "/app/requisitions/$id", params: { id } });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Org context */}
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.form.orgContext")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.entity")}</Label>
            <Select value={entityId || undefined} onValueChange={(v) => { setEntityId(v); setBranchId(""); setDepartmentId(""); }}>
              <SelectTrigger><SelectValue placeholder={t("requisition.form.select")} /></SelectTrigger>
              <SelectContent>{entities.map((e) => <SelectItem key={e.id} value={e.id}>{name(e)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.branch")}</Label>
            <Select value={branchId || undefined} onValueChange={(v) => { setBranchId(v); setDepartmentId(""); }} disabled={!entityId}>
              <SelectTrigger><SelectValue placeholder={t("requisition.form.select")} /></SelectTrigger>
              <SelectContent>{availableBranches.map((b) => <SelectItem key={b.id} value={b.id}>{name(b)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.department")}</Label>
            <Select value={departmentId || undefined} onValueChange={setDepartmentId} disabled={!branchId}>
              <SelectTrigger><SelectValue placeholder={t("requisition.form.select")} /></SelectTrigger>
              <SelectContent>{availableDepartments.map((d) => <SelectItem key={d.id} value={d.id}>{name(d)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Position */}
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.form.position")}</h3>
        <Select value={positionId || undefined} onValueChange={onPositionChange}>
          <SelectTrigger className="sm:max-w-md"><SelectValue placeholder={t("requisition.form.selectPosition")} /></SelectTrigger>
          <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{name(p)}</SelectItem>)}</SelectContent>
        </Select>
        {jdTemplateId && <p className="text-xs text-muted-foreground">{t("requisition.form.templateSuggested")}</p>}
      </section>

      {/* JD (editable into the snapshot) */}
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.form.jd")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.titleEn")}</Label>
            <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.titleAr")}</Label>
            <Input dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.summaryEn")}</Label>
            <Textarea value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.summaryAr")}</Label>
            <Textarea dir="rtl" value={summaryAr} onChange={(e) => setSummaryAr(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("requisition.form.jdHint")}</p>
      </section>

      {/* Details */}
      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.form.details")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.headcount")}</Label>
            <Input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.employmentType")}</Label>
            <Select value={employmentType || undefined} onValueChange={setEmploymentType}>
              <SelectTrigger><SelectValue placeholder={t("requisition.form.select")} /></SelectTrigger>
              <SelectContent>{empTypes.map((l) => <SelectItem key={l.code} value={l.code}>{lkName(l)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.contractType")}</Label>
            <Select value={contractType || undefined} onValueChange={setContractType}>
              <SelectTrigger><SelectValue placeholder={t("requisition.form.select")} /></SelectTrigger>
              <SelectContent>{contractTypes.map((l) => <SelectItem key={l.code} value={l.code}>{lkName(l)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.targetStart")}</Label>
            <Input type="date" value={targetStart} onChange={(e) => setTargetStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.salaryMin")}</Label>
            <Input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("requisition.form.salaryMax")}</Label>
            <Input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
        </div>

        {/* Budgeted indicator (warn-only) */}
        {budget && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-sm">
            <span className="text-muted-foreground">
              {t("requisition.budget.budgeted")}: <span className="text-foreground">{budget.budgeted}</span>
            </span>
            <span className="text-muted-foreground">
              {t("requisition.budget.filled")}: <span className="text-foreground">{budget.filled}</span>
            </span>
            <span className="text-muted-foreground">
              {t("requisition.budget.available")}: <span className="text-foreground">{budget.available}</span>
            </span>
            {budget.over_budget && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {t("requisition.budget.overBudget")}
              </Badge>
            )}
          </div>
        )}
      </section>

      {/* Justification (EN-only, internal) */}
      <section className="space-y-2 rounded-md border p-4">
        <Label>{t("requisition.form.justification")}</Label>
        <span className="block text-xs text-muted-foreground">{t("requisition.form.justificationInternal")}</span>
        <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} dir="ltr" />
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSaveDraft} disabled={saving || !valid || !canWriteReq}>
          {t("requisition.actions.saveDraft")}
        </Button>
        <Button onClick={onSubmit} disabled={saving || !valid || !canSubmitReq}>
          {t("requisition.actions.submit")}
        </Button>
      </div>
    </div>
  );
}
