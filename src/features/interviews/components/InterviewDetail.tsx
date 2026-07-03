// Module M1.7 — InterviewDetail: header + actions (reschedule/cancel/record
// outcome), panelist list, panel feedback summary, the caller's panelist
// scorecard, and the reused M0.5 <AuditTrail entityType="interview"/>.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Video, Copy } from "lucide-react";

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
import { AuditTrail } from "@/features/audit/components/AuditTrail";
import {
  cancelInterview,
  interviewDetail,
  interviewPanelSummary,
  recordInterviewOutcome,
  rescheduleInterview,
} from "../api";
import type { InterviewOutcome } from "../types";
import { InterviewScorecardForm } from "./InterviewScorecardForm";
import { MeetingNotesPanel } from "./MeetingNotesPanel";

interface InterviewDetailProps {
  id: string;
  currentUserId?: string | null;
}

export function InterviewDetail({ id, currentUserId = null }: InterviewDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["interviews", "detail", id], queryFn: () => interviewDetail(id) });
  const summaryQ = useQuery({ queryKey: ["interviews", "summary", id], queryFn: () => interviewPanelSummary(id) });

  const [newDatetime, setNewDatetime] = useState("");
  const [outcome, setOutcome] = useState<InterviewOutcome | "">("");
  const [busy, setBusy] = useState(false);

  const data = q.data;
  const iv = data?.interview ?? null;
  const candidate = data?.candidate ?? null;
  const panelists = data?.panelists ?? [];
  const scores = data?.scores ?? [];
  const criteria = data?.criteria ?? [];
  const summary = summaryQ.data ?? null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["interviews", "detail", id] });
    qc.invalidateQueries({ queryKey: ["interviews", "summary", id] });
  };

  const candName = candidate
    ? (language === "ar" ? candidate.full_name_ar : candidate.full_name_en) || candidate.full_name_en || candidate.email
    : "";

  const onReschedule = async () => {
    if (!newDatetime) return;
    setBusy(true);
    try {
      await rescheduleInterview(id, new Date(newDatetime).toISOString());
      toast.success(t("interviews.toasts.rescheduled"));
      setNewDatetime("");
      refresh();
    } catch {
      toast.error(t("interviews.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    setBusy(true);
    try {
      await cancelInterview(id, null);
      toast.success(t("interviews.toasts.cancelled"));
      refresh();
    } catch {
      toast.error(t("interviews.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  const onRecordOutcome = async () => {
    if (!outcome) return;
    setBusy(true);
    try {
      await recordInterviewOutcome(id, outcome);
      toast.success(t("interviews.toasts.outcomeRecorded"));
      setOutcome("");
      refresh();
    } catch {
      toast.error(t("interviews.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("interviews.common.loading")}</p>;
  if (!iv) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("interviews.detail.notFound")}</p>;
  }

  const terminal = iv.status === "completed" || iv.status === "cancelled";
  const myScore = currentUserId ? scores.find((s) => s.panelist_user_id === currentUserId) ?? null : null;
  const panelName = (p: { name_en: string | null; name_ar: string | null; email: string | null }) =>
    (language === "ar" ? p.name_ar : p.name_en) || p.email || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{iv.reference ?? id}</h1>
          <Badge variant="outline">{t(`interviews.status.${iv.status}`)}</Badge>
          <Badge variant="secondary">{t(`interviews.mode.${iv.mode}`)}</Badge>
          {iv.calendar_status !== "none" && (
            <Badge variant="outline">{t(`interviews.calendar.${iv.calendar_status}`)}</Badge>
          )}
          {iv.outcome && <Badge>{t(`interviews.outcome.${iv.outcome}`)}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {iv.teams_join_url && (
            <a href={iv.teams_join_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <Video className="h-4 w-4" /> {t("interviews.detail.joinTeams")}
            </a>
          )}
          {(iv.teams_join_url || iv.outlook_web_link) && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(iv.teams_join_url ?? iv.outlook_web_link ?? "");
                  toast.success(t("interviews.detail.linkCopied"));
                } catch {
                  toast.error(t("interviews.toasts.error"));
                }
              }}
            >
              <Copy className="h-4 w-4" /> {t("interviews.detail.copyInvite")}
            </Button>
          )}
        </div>
      </header>

      {/* Summary line */}
      <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
        <Detail label={t("interviews.detail.candidate")} value={candName ?? "—"} />
        <Detail label={t("interviews.schedule.datetime")} value={iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : "—"} />
        <Detail label={t("interviews.schedule.duration")} value={`${iv.duration_min} ${t("interviews.detail.minutes")}`} />
        <Detail label={t("interviews.schedule.location")} value={iv.room_name || iv.location || "—"} />
      </section>

      {/* Actions */}
      {!terminal && (
        <section className="space-y-3 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("interviews.detail.actions")}</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("interviews.actions.reschedule")}</span>
              <div className="flex items-center gap-2">
                <Input type="datetime-local" dir="ltr" value={newDatetime} onChange={(e) => setNewDatetime(e.target.value)} className="h-9" />
                <Button variant="outline" onClick={onReschedule} disabled={busy || !newDatetime}>{t("interviews.actions.reschedule")}</Button>
              </div>
            </div>
            <Button variant="outline" onClick={onCancel} disabled={busy}>{t("interviews.actions.cancelInterview")}</Button>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("interviews.actions.recordOutcome")}</span>
              <div className="flex items-center gap-2">
                <Select value={outcome || undefined} onValueChange={(v) => setOutcome(v as InterviewOutcome)}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder={t("interviews.scorecard.recommendation")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proceed">{t("interviews.outcome.proceed")}</SelectItem>
                    <SelectItem value="reject">{t("interviews.outcome.reject")}</SelectItem>
                    <SelectItem value="hold">{t("interviews.outcome.hold")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={onRecordOutcome} disabled={busy || !outcome}>{t("interviews.actions.recordOutcome")}</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Panel */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("interviews.detail.panel")}</h3>
        {panelists.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("interviews.detail.noPanel")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {panelists.map((p) => (
              <li key={p.id}><Badge variant="outline">{panelName(p)}</Badge></li>
            ))}
          </ul>
        )}
      </section>

      {/* Panel feedback summary */}
      <section className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-foreground">{t("interviews.detail.feedback")}</h3>
          {summary?.panel_average != null && (
            <span className="text-sm text-muted-foreground">
              {t("interviews.detail.panelAverage")}:{" "}
              <span className="font-medium text-foreground" dir="ltr">{summary.panel_average}</span>
            </span>
          )}
        </div>
        {scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("interviews.detail.noFeedback")}</p>
        ) : (
          <ul className="space-y-1">
            {scores.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-foreground">
                  {(language === "ar" ? s.panelist_name_ar : s.panelist_name_en) ?? "—"}
                </span>
                <span className="flex items-center gap-2">
                  {s.recommendation && (
                    <Badge variant={s.recommendation === "reject" ? "destructive" : "default"}>
                      {t(`interviews.outcome.${s.recommendation}`)}
                    </Badge>
                  )}
                  <span className="font-medium text-foreground" dir="ltr">{s.overall_score ?? "—"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Meeting notes + AI summary (M2.5) */}
      <MeetingNotesPanel interviewId={id} />

      {/* Caller's panelist scorecard */}
      {!terminal && (
        <section className="space-y-2 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("interviews.detail.myScorecard")}</h3>
          {currentUserId ? (
            <InterviewScorecardForm interviewId={id} criteria={criteria} existing={myScore} onSaved={refresh} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("interviews.detail.signInToScore")}</p>
          )}
        </section>
      )}

      {/* Audit trail (reused) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("interviews.detail.audit")}</h3>
        <AuditTrail entityType="interview" entityRef={id} />
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
