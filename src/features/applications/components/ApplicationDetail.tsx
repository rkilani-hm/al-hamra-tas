// Module M1.5 — application detail. Stage-move + status actions, candidate info,
// stage history, and the reused M0.5 <DocumentPanel> (CV/attachments) + <AuditTrail>.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { DocumentPanel } from "@/features/documents/components/DocumentPanel";
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import { ScreeningPanel } from "@/features/screening/components/ScreeningPanel";
import { InterviewPanel } from "@/features/interviews/components/InterviewPanel";
import { OfferPanel } from "@/features/offers/components/OfferPanel";
import { AssessmentPanel } from "@/features/assessment/components/AssessmentPanel";
import { PreBoardingPanel } from "@/features/preboarding/components/PreBoardingPanel";
import {
  applicationDetail,
  listPipelineStages,
  moveApplicationStage,
  safe,
  setApplicationStatus,
} from "../api";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";

interface ApplicationDetailProps {
  id: string;
  currentUserId?: string | null;
}

export function ApplicationDetail({ id, currentUserId = null }: ApplicationDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWriteApp = capabilities.includes("application.write");
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["applications", "detail", id], queryFn: () => applicationDetail(id) });
  const stagesQ = useQuery({ queryKey: ["applications", "stages"], queryFn: safe(listPipelineStages) });
  const stages = stagesQ.data ?? [];

  const data = q.data;
  const app = data?.application ?? null;
  const candidate = data?.candidate ?? null;
  const currentStage = data?.current_stage ?? null;
  const requisition = data?.requisition ?? null;
  const history = data?.history ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["applications", "detail", id] });
  const stageName = (s: { name_en: string; name_ar: string } | null) =>
    s ? (language === "ar" ? s.name_ar : s.name_en) : "—";
  const candName = candidate
    ? (language === "ar" ? candidate.full_name_ar : candidate.full_name_en) || candidate.full_name_en || candidate.email
    : "";

  const onMove = async (toStageId: string) => {
    try {
      await moveApplicationStage(id, toStageId, null);
      toast.success(t("applications.toasts.moved"));
      await refresh();
    } catch {
      toast.error(t("applications.toasts.actionError"));
    }
  };
  const onStatus = async (status: string) => {
    try {
      await setApplicationStatus(id, status, null);
      toast.success(t("applications.toasts.actionDone"));
      await refresh();
    } catch {
      toast.error(t("applications.toasts.actionError"));
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("applications.common.loading")}</p>;
  if (!app) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("applications.detail.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{app.reference}</h1>
          <Badge variant="outline">{stageName(currentStage)}</Badge>
          <ApplicationStatusBadge status={app.status} />
        </div>
        {canWriteApp && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={app.current_stage_id ?? undefined} onValueChange={onMove}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("applications.detail.moveStage")} /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{language === "ar" ? s.name_ar : s.name_en}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => onStatus("on_hold")}>{t("applications.actions.hold")}</Button>
            <Button variant="outline" onClick={() => onStatus("withdrawn")}>{t("applications.actions.withdraw")}</Button>
            <Button variant="destructive" onClick={() => onStatus("rejected")}>{t("applications.actions.reject")}</Button>
          </div>
        )}
      </header>

      {/* Candidate + requisition */}
      <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <Detail label={t("applications.detail.candidate")} value={candName ?? "—"} />
        <Detail label={t("applications.candidate.email")} value={candidate?.email ?? "—"} />
        <Detail label={t("applications.candidate.nationalityClass")} value={candidate?.nationality_class ?? "—"} />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{t("applications.table.requisition")}</span>
          {requisition ? (
            <Link to="/app/requisitions/$id" params={{ id: requisition.id }} className="text-sm text-primary hover:underline">
              {requisition.reference ?? requisition.id}
            </Link>
          ) : (
            <span className="text-sm text-foreground">—</span>
          )}
        </div>
        <Detail label={t("applications.candidate.currentTitle")} value={candidate?.current_title ?? "—"} />
        <Detail label={t("applications.candidate.source")} value={app.source ?? "—"} />
      </section>

      {/* Stage history */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("applications.detail.history")}</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("applications.detail.noHistory")}</p>
        ) : (
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{stageName(h.from_stage)}</span>
                <span aria-hidden>→</span>
                <span className="font-medium text-foreground">{stageName(h.to_stage)}</span>
                {h.note && <span className="text-xs text-muted-foreground">“{h.note}”</span>}
                <span className="text-xs text-muted-foreground" dir="ltr">{new Date(h.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Documents (reused) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("applications.detail.documents")}</h3>
        <DocumentPanel entityType="application" entityRef={id} currentUserId={currentUserId} />
      </section>

      {/* Screening (M1.6, reused panel) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("screening.panel.title")}</h3>
        <ScreeningPanel applicationId={id} />
      </section>

      {/* Interviews (M1.7, reused panel) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("interviews.panel.title")}</h3>
        <InterviewPanel applicationId={id} />
      </section>

      {/* Assessment & Evaluation (M1.8) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("assessment.panel.title")}</h3>
        <AssessmentPanel applicationId={id} />
      </section>

      {/* Offer (M1.9, reused panel) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("offers.panel.title")}</h3>
        <OfferPanel applicationId={id} candidateId={candidate?.id ?? null} currentUserId={currentUserId} />
      </section>

      {/* Pre-Boarding (M1.10) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("preboarding.panel.title")}</h3>
        <PreBoardingPanel applicationId={id} />
      </section>

      {/* Audit trail (reused) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("applications.detail.audit")}</h3>
        <AuditTrail entityType="application" entityRef={id} />
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
