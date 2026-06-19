// Module M1.2 — requisition detail. Derive-on-read (sync_requisition_status) then
// render. Reuses M0.3 <ApprovalTimeline>/<WorkflowStatusBadge>, M0.5 <AuditTrail>
// and <DocumentPanel> — does NOT rebuild them.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/use-language";
import { WorkflowStatusBadge } from "@/features/workflow/components/WorkflowStatusBadge";
import { ApprovalTimeline } from "@/features/workflow/components/ApprovalTimeline";
import type { InstanceStatus } from "@/features/workflow/types";
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import { DocumentPanel } from "@/features/documents/components/DocumentPanel";
import {
  requisitionDetail,
  submitRequisition,
  syncRequisitionStatus,
  transitionRequisition,
  updateDraftRequisition,
} from "../api";
import type {
  RequisitionAction,
  RequisitionRecord,
  RequisitionStatus,
} from "../types";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";

interface RequisitionDetailProps {
  id: string;
  currentUserId?: string | null;
}

// Which lifecycle actions are offered per status.
const ACTIONS_BY_STATUS: Record<RequisitionStatus, (RequisitionAction | "submit")[]> = {
  draft: ["submit"],
  submitted: [],
  in_approval: ["hold", "cancel"],
  approved: ["publish", "hold", "cancel"],
  published: ["hold", "close", "cancel"],
  on_hold: ["close", "cancel"],
  cancelled: [],
  closed: [],
};

export function RequisitionDetail({ id, currentUserId = null }: RequisitionDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit-draft fields (loaded from the record when entering edit mode).
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const [justification, setJustification] = useState("");

  // Derive-on-read: sync terminal status, then fetch the detail.
  const q = useQuery({
    queryKey: ["requisition", "detail", id],
    queryFn: async () => {
      try {
        await syncRequisitionStatus(id);
      } catch {
        /* sync is best-effort; render whatever we can */
      }
      return requisitionDetail(id);
    },
  });

  const req = (q.data?.requisition ?? null) as RequisitionRecord | null;
  const events = q.data?.events ?? [];
  // Live workflow instance status (from the instance_timeline jsonb) for the
  // reused <WorkflowStatusBadge>.
  const instanceStatus =
    ((q.data?.instance as { instance?: { status?: string } } | null)?.instance?.status ??
      null) as InstanceStatus | null;
  const refresh = () => qc.invalidateQueries({ queryKey: ["requisition", "detail", id] });

  const title = req ? (language === "ar" ? req.title_ar : req.title_en) || req.title_en || req.title_ar || req.reference : "";
  const snapshot = (q.data?.jd_snapshot ?? {}) as Record<string, unknown>;

  const beginEdit = () => {
    if (!req) return;
    setTitleEn(req.title_en ?? "");
    setTitleAr(req.title_ar ?? "");
    setHeadcount(String(req.headcount ?? 1));
    setJustification(req.justification_en ?? "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setBusy(true);
    try {
      await updateDraftRequisition(id, {
        title_en: titleEn.trim() || null,
        title_ar: titleAr.trim() || null,
        headcount: Number(headcount) || 1,
        justification_en: justification.trim() || null,
      });
      toast.success(t("requisition.toasts.draftSaved"));
      setEditing(false);
      await refresh();
    } catch {
      toast.error(t("requisition.toasts.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: RequisitionAction | "submit") => {
    setBusy(true);
    try {
      if (action === "submit") await submitRequisition(id);
      else await transitionRequisition(id, action);
      toast.success(t("requisition.toasts.actionDone"));
      await refresh();
    } catch {
      toast.error(t("requisition.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("requisition.common.loading")}</p>;
  }
  if (!req) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("requisition.detail.notFound")}
      </p>
    );
  }

  const actions = ACTIONS_BY_STATUS[req.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{req.reference}</h1>
          <RequisitionStatusBadge status={req.status} />
          {req.workflow_instance_id && instanceStatus && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {t("requisition.detail.approval")}: <WorkflowStatusBadge status={instanceStatus} />
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {req.status === "draft" && !editing && (
            <Button variant="outline" onClick={beginEdit} disabled={busy}>{t("requisition.actions.edit")}</Button>
          )}
          {actions.map((a) => (
            <Button key={a} variant={a === "cancel" ? "destructive" : a === "submit" ? "default" : "outline"} onClick={() => runAction(a)} disabled={busy}>
              {t(`requisition.actions.${a}`)}
            </Button>
          ))}
        </div>
      </header>

      <p className="text-lg text-foreground">{title}</p>

      {/* Edit draft (note: persistence is service-role until M3.1 — fails soft) */}
      {editing && (
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("requisition.detail.editDraft")}</h3>
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
              <Label>{t("requisition.form.headcount")}</Label>
              <Input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>{t("requisition.form.justification")}</Label>
              <Textarea dir="ltr" value={justification} onChange={(e) => setJustification(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>{t("requisition.actions.cancelEdit")}</Button>
            <Button onClick={saveEdit} disabled={busy}>{t("requisition.actions.saveDraft")}</Button>
          </div>
        </section>
      )}

      {/* JD snapshot (bilingual) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.detail.jd")}</h3>
        {(() => {
          const sumEn = (snapshot.summary_en as string) ?? "";
          const sumAr = (snapshot.summary_ar as string) ?? "";
          if (!sumEn && !sumAr) return <p className="text-sm text-muted-foreground">{t("requisition.detail.noJd")}</p>;
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sumEn}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground" dir="rtl">{sumAr}</p>
            </div>
          );
        })()}
      </section>

      {/* Details */}
      <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <Detail label={t("requisition.table.headcount")} value={String(req.headcount)} />
        <Detail label={t("requisition.form.employmentType")} value={req.employment_type ?? "—"} />
        <Detail label={t("requisition.form.contractType")} value={req.contract_type ?? "—"} />
        <Detail label={t("requisition.form.targetStart")} value={req.target_start_date ?? "—"} />
        <Detail label={t("requisition.form.salaryMin")} value={req.salary_min != null ? String(req.salary_min) : "—"} />
        <Detail label={t("requisition.form.salaryMax")} value={req.salary_max != null ? String(req.salary_max) : "—"} />
      </section>

      {/* Approval timeline (reused M0.3 component, live from the linked instance) */}
      {req.workflow_instance_id && (
        <section className="rounded-md border p-4">
          <ApprovalTimeline instanceId={req.workflow_instance_id} />
        </section>
      )}

      {/* Requisition event history */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.detail.history")}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("requisition.detail.noHistory")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{e.event_type}</span>
                {e.from_status && e.to_status && (
                  <span className="text-xs text-muted-foreground">{e.from_status} → {e.to_status}</span>
                )}
                <span className="text-xs text-muted-foreground" dir="ltr">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documents (reused M0.5 reusable) + Audit trail (reused M0.5 reusable) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.detail.documents")}</h3>
        <DocumentPanel entityType="requisition" entityRef={id} currentUserId={currentUserId} />
      </section>

      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("requisition.detail.audit")}</h3>
        <AuditTrail entityType="requisition" entityRef={id} />
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
