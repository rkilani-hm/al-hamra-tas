// Module M0.3 — workflow step builder.
// Ordered steps; per step: name EN/AR, approver rule (Role / Hierarchy / Named
// user with contextual picker from M0.1 roles & M0.2 hierarchy), condition
// builder (field/op/value), quorum, SLA hours, on-reject. Reorder via move
// up/down (RTL-aware; v1 uses buttons instead of a drag-and-drop dependency).

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/use-language";
import { listRoles, listUsers } from "@/features/identity/api";
import { saveSteps, listSteps } from "../api";
import {
  CONDITION_OPS,
  type ApproverRuleType,
  type ConditionOp,
  type StepDraft,
  type WorkflowDefinition,
} from "../types";

const HIERARCHY_RELATIVES = ["branch_manager", "department_head", "entity_admin"] as const;

interface WorkflowBuilderProps {
  definition: WorkflowDefinition;
}

function emptyStep(stepNo: number): StepDraft {
  return {
    step_no: stepNo,
    name_en: "",
    name_ar: "",
    approver_rule_type: "role",
    approver_rule_value: { role_code: "" },
    condition_json: null,
    quorum: 1,
    sla_hours: null,
    on_reject: "stop",
  };
}

export function WorkflowBuilder({ definition }: WorkflowBuilderProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const stepsQ = useQuery({
    queryKey: ["workflow", "steps", definition.id],
    queryFn: () => listSteps(definition.id),
  });
  const rolesQ = useQuery({ queryKey: ["workflow", "roles"], queryFn: listRoles });
  const usersQ = useQuery({ queryKey: ["workflow", "users"], queryFn: listUsers });

  const roles = rolesQ.data ?? [];
  const users = usersQ.data ?? [];

  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);

  // Load persisted steps into the editable draft.
  useEffect(() => {
    if (stepsQ.data) {
      setSteps(
        stepsQ.data.map((s) => ({
          id: s.id,
          step_no: s.step_no,
          name_en: s.name_en,
          name_ar: s.name_ar,
          approver_rule_type: s.approver_rule_type,
          approver_rule_value: s.approver_rule_value,
          condition_json: s.condition_json,
          quorum: s.quorum,
          sla_hours: s.sla_hours,
          on_reject: s.on_reject,
        })),
      );
    }
  }, [stepsQ.data]);

  const roleName = (code: string) => {
    const r = roles.find((x) => x.code === code);
    return r ? (language === "ar" ? r.name_ar : r.name_en) : code;
  };
  const userName = useMemo(
    () => (id: string) => {
      const u = users.find((x) => x.id === id);
      if (!u) return id;
      return (language === "ar" ? u.display_name_ar : u.display_name_en) || u.email;
    },
    [users, language],
  );

  const update = (i: number, patch: Partial<StepDraft>) =>
    setSteps((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const remove = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const add = () => setSteps((s) => [...s, emptyStep(s.length + 1)]);
  const move = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const setRuleType = (i: number, type: ApproverRuleType) => {
    const value =
      type === "role"
        ? { role_code: "" }
        : type === "hierarchy"
          ? { relative: "branch_manager" as const }
          : { user_id: "" };
    update(i, { approver_rule_type: type, approver_rule_value: value });
  };

  // Condition helpers (field/op/value <-> condition_json).
  const setCondField = (i: number, field: string) => {
    const c = steps[i].condition_json;
    if (!field.trim()) return update(i, { condition_json: null });
    update(i, { condition_json: { field, op: c?.op ?? "=", value: c?.value ?? "" } });
  };
  const setCondOp = (i: number, op: ConditionOp) => {
    const c = steps[i].condition_json;
    if (!c) return;
    update(i, { condition_json: { ...c, op } });
  };
  const setCondValue = (i: number, raw: string) => {
    const c = steps[i].condition_json;
    if (!c) return;
    // numeric if it parses; otherwise string. 'in' => comma list.
    let value: unknown = raw;
    if (c.op === "in") {
      value = raw.split(",").map((x) => (isNaN(Number(x.trim())) ? x.trim() : Number(x.trim())));
    } else if (raw.trim() !== "" && !isNaN(Number(raw))) {
      value = Number(raw);
    }
    update(i, { condition_json: { ...c, value } });
  };
  const condValueText = (c: StepDraft["condition_json"]) => {
    if (!c) return "";
    if (Array.isArray(c.value)) return (c.value as unknown[]).join(",");
    return c.value == null ? "" : String(c.value);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveSteps(definition.id, steps);
      toast.success(t("workflow.toasts.saved"));
    } catch {
      toast.error(t("workflow.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t("workflow.builder.title")} — {language === "ar" ? definition.name_ar : definition.name_en}
        </h2>
        <Button className="gap-1" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {t("workflow.builder.saveSteps")}
        </Button>
      </div>

      {steps.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("workflow.builder.noSteps")}
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step, i) => {
            const rv = step.approver_rule_value as Record<string, string>;
            return (
              <div key={step.id ?? i} className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("workflow.buttons.moveUp")} onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("workflow.buttons.moveDown")} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("workflow.buttons.remove")} onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Names */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>{t("workflow.fields.nameEn")}</Label>
                    <Input value={step.name_en} onChange={(e) => update(i, { name_en: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t("workflow.fields.nameAr")}</Label>
                    <Input dir="rtl" value={step.name_ar} onChange={(e) => update(i, { name_ar: e.target.value })} />
                  </div>
                </div>

                {/* Approver rule */}
                <div className="space-y-2">
                  <Label>{t("workflow.builder.approverRule")}</Label>
                  <Tabs value={step.approver_rule_type} onValueChange={(v) => setRuleType(i, v as ApproverRuleType)}>
                    <TabsList>
                      <TabsTrigger value="role">{t("workflow.ruleType.role")}</TabsTrigger>
                      <TabsTrigger value="hierarchy">{t("workflow.ruleType.hierarchy")}</TabsTrigger>
                      <TabsTrigger value="named_user">{t("workflow.ruleType.named_user")}</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {step.approver_rule_type === "role" && (
                    <Select value={rv.role_code || undefined} onValueChange={(v) => update(i, { approver_rule_value: { role_code: v } })}>
                      <SelectTrigger><SelectValue placeholder={t("workflow.builder.pickRole")} /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.code}>{roleName(r.code)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {step.approver_rule_type === "hierarchy" && (
                    <Select value={rv.relative || undefined} onValueChange={(v) => update(i, { approver_rule_value: { relative: v as never } })}>
                      <SelectTrigger><SelectValue placeholder={t("workflow.builder.pickRelative")} /></SelectTrigger>
                      <SelectContent>
                        {HIERARCHY_RELATIVES.map((rel) => (
                          <SelectItem key={rel} value={rel}>{t(`workflow.relative.${rel}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {step.approver_rule_type === "named_user" && (
                    <Select value={rv.user_id || undefined} onValueChange={(v) => update(i, { approver_rule_value: { user_id: v } })}>
                      <SelectTrigger><SelectValue placeholder={t("workflow.builder.pickUser")} /></SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{userName(u.id)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Condition builder */}
                <div className="space-y-2">
                  <Label>{t("workflow.builder.condition")}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder={t("workflow.builder.field")}
                      value={step.condition_json?.field ?? ""}
                      onChange={(e) => setCondField(i, e.target.value)}
                    />
                    <Select
                      value={step.condition_json?.op ?? "="}
                      onValueChange={(v) => setCondOp(i, v as ConditionOp)}
                      disabled={!step.condition_json}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPS.map((op) => (
                          <SelectItem key={op} value={op}>{op}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={t("workflow.builder.value")}
                      value={condValueText(step.condition_json)}
                      onChange={(e) => setCondValue(i, e.target.value)}
                      disabled={!step.condition_json}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("workflow.builder.conditionHint")}</p>
                </div>

                {/* Quorum / SLA / on-reject */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>{t("workflow.builder.quorum")}</Label>
                    <Input type="number" min={1} value={step.quorum} onChange={(e) => update(i, { quorum: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t("workflow.builder.slaHours")}</Label>
                    <Input type="number" min={0} value={step.sla_hours ?? ""} onChange={(e) => update(i, { sla_hours: e.target.value ? Number(e.target.value) : null })} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t("workflow.builder.onReject")}</Label>
                    <Select value={step.on_reject} onValueChange={(v) => update(i, { on_reject: v as "stop" | "return" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stop">{t("workflow.onReject.stop")}</SelectItem>
                        <SelectItem value="return">{t("workflow.onReject.return")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button variant="outline" className="gap-1" onClick={add}>
        <Plus className="h-4 w-4" /> {t("workflow.builder.addStep")}
      </Button>
    </div>
  );
}
