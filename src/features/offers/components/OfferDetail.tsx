// Module M1.9 — offer detail. Derive-on-read (sync_offer_status) then render.
// Reuses M0.3 <ApprovalTimeline>/<WorkflowStatusBadge>, M0.5 <DocumentPanel>/
// <AuditTrail> — does NOT rebuild them. Sensitive write actions are service-role
// until M3.1 (fail-soft toast), mirroring M1.2.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { WorkflowStatusBadge } from "@/features/workflow/components/WorkflowStatusBadge";
import { ApprovalTimeline } from "@/features/workflow/components/ApprovalTimeline";
import type { InstanceStatus } from "@/features/workflow/types";
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import { DocumentPanel } from "@/features/documents/components/DocumentPanel";
import {
  issueOffer,
  offerDetail,
  respondToOffer,
  submitOffer,
  syncOfferStatus,
  transitionOffer,
} from "../api";
import type { OfferDecision, OfferStatus } from "../types";
import { OfferLetterPreview } from "./OfferLetterPreview";
import { OfferForm } from "./OfferForm";
import { AdapterStatus } from "./AdapterStatus";

interface OfferDetailProps {
  id: string;
  currentUserId?: string | null;
}

export function OfferDetail({ id, currentUserId = null }: OfferDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canViewOffer = capabilities.includes("offer.view");
  const canWriteOffer = capabilities.includes("offer.write");
  const canSubmitOffer = capabilities.includes("offer.submit");
  const canIssueOffer = capabilities.includes("offer.issue");
  const canRespondOffer = capabilities.includes("offer.respond");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [decision, setDecision] = useState<OfferDecision | "">("");
  const [reason, setReason] = useState("");

  const q = useQuery({
    queryKey: ["offers", "detail", id],
    enabled: canViewOffer,
    queryFn: async () => {
      try {
        await syncOfferStatus(id);
      } catch {
        /* sync is best-effort */
      }
      return offerDetail(id);
    },
  });

  const data = q.data;
  const offer = data?.offer ?? null;
  const candidate = data?.candidate ?? null;
  const events = data?.events ?? [];
  const instanceStatus = (data?.instance?.instance?.status ?? null) as InstanceStatus | null;
  const snapshot = data?.letter_snapshot ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["offers", "detail", id] });

  const candName = candidate
    ? (language === "ar" ? candidate.full_name_ar : candidate.full_name_en) || candidate.full_name_en || candidate.email
    : "";

  const runAction = async (fn: () => Promise<unknown>, okKey: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(t(okKey));
      await refresh();
    } catch {
      toast.error(t("offers.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onRecordResponse = async () => {
    if (!decision) return;
    await runAction(() => respondToOffer(id, decision, reason || null), "offers.toasts.responseRecorded");
    setDecision("");
    setReason("");
  };

  if (!canViewOffer) return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("offers.detail.noViewPermission")}</p>;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("offers.common.loading")}</p>;
  if (!offer) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("offers.detail.notFound")}</p>;
  }

  const status = offer.status as OfferStatus;
  const salaryText = offer.salary_amount != null ? `${offer.salary_amount} ${offer.currency}` : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{offer.reference ?? id}</h1>
          <Badge variant="outline">{t(`offers.status.${status}`)}</Badge>
          {offer.workflow_instance_id && instanceStatus && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              {t("offers.detail.approval")}: <WorkflowStatusBadge status={instanceStatus} />
            </span>
          )}
          <Badge variant="secondary">{t(`offers.esign.${offer.esign_status}`)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "draft" && !editing && canWriteOffer && (
            <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>{t("offers.actions.edit")}</Button>
          )}
          {status === "draft" && canSubmitOffer && (
            <Button onClick={() => runAction(() => submitOffer(id), "offers.toasts.submitted")} disabled={busy}>{t("offers.actions.submit")}</Button>
          )}
          {status === "approved" && canIssueOffer && (
            <Button onClick={() => runAction(() => issueOffer(id), "offers.toasts.issued")} disabled={busy}>{t("offers.actions.issue")}</Button>
          )}
          {(status === "in_approval" || status === "approved" || status === "issued") && canWriteOffer && (
            <Button variant="destructive" onClick={() => runAction(() => transitionOffer(id, "cancel"), "offers.toasts.actionDone")} disabled={busy}>{t("offers.actions.cancel")}</Button>
          )}
          {status === "issued" && canWriteOffer && (
            <Button variant="outline" onClick={() => runAction(() => transitionOffer(id, "expire"), "offers.toasts.actionDone")} disabled={busy}>{t("offers.actions.expire")}</Button>
          )}
        </div>
      </header>

      {/* Edit draft */}
      {status === "draft" && editing && (
        <OfferForm
          applicationId={offer.application_id}
          candidateId={offer.candidate_id}
          offer={offer}
          currentUserId={currentUserId}
          onSaved={() => { setEditing(false); refresh(); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Summary */}
      <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <Detail label={t("offers.detail.candidate")} value={candName ?? "—"} />
        <Detail label={t("offers.form.salary")} value={salaryText} />
        <Detail label={t("offers.form.contractType")} value={offer.contract_type ?? "—"} />
        <Detail label={t("offers.form.startDate")} value={offer.start_date ?? "—"} />
        <Detail label={t("offers.form.probation")} value={offer.probation_months != null ? String(offer.probation_months) : "—"} />
        <Detail label={t("offers.detail.onboardingReady")} value={offer.onboarding_ready ? t("offers.detail.yes") : t("offers.detail.no")} />
      </section>

      {/* Approval timeline (reused M0.3 component) */}
      {offer.workflow_instance_id && (
        <section className="rounded-md border p-4">
          <ApprovalTimeline instanceId={offer.workflow_instance_id} />
        </section>
      )}

      {/* Record candidate response (recruiter-recorded) — issued offers only */}
      {status === "issued" && canRespondOffer && (
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("offers.detail.recordResponse")}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex w-40 flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("offers.detail.decision")}</span>
              <Select value={decision || undefined} onValueChange={(v) => setDecision(v as OfferDecision)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t("offers.detail.decision")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="accept">{t("offers.actions.accept")}</SelectItem>
                  <SelectItem value="decline">{t("offers.actions.decline")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {decision === "decline" && (
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t("offers.detail.reason")}</span>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} className="h-9" />
              </div>
            )}
            <Button onClick={onRecordResponse} disabled={busy || !decision}>{t("offers.actions.recordResponse")}</Button>
          </div>
        </section>
      )}

      {/* Bilingual letter preview */}
      <section className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-foreground">{t("offers.detail.letter")}</h3>
          <AdapterStatus />
        </div>
        <OfferLetterPreview snapshot={snapshot} />
      </section>

      {/* Documents (reused M0.5 — the offer letter doc) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("offers.detail.documents")}</h3>
        <DocumentPanel entityType="offer" entityRef={id} currentUserId={currentUserId} />
      </section>

      {/* Offer event history */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("offers.detail.history")}</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("offers.detail.noHistory")}</p>
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

      {/* Audit trail (reused M0.5) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("offers.detail.audit")}</h3>
        <AuditTrail entityType="offer" entityRef={id} />
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
