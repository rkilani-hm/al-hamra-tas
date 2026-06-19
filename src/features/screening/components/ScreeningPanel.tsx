// Module M1.6 — ScreeningPanel: reusable <ScreeningPanel applicationId/> embedded
// in M1.5's ApplicationDetail. Shows existing screening(s) or a "Start screening"
// CTA; an open draft renders the editable <ScreeningForm/>.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createScreening, listScreeningScorecards, safe, screeningDetail } from "../api";
import type { ScreeningRecord } from "../types";
import { ScreeningForm } from "./ScreeningForm";

interface ScreeningPanelProps {
  applicationId: string;
}

export function ScreeningPanel({ applicationId }: ScreeningPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [scorecardId, setScorecardId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const detailQ = useQuery({
    queryKey: ["screening", "detail", applicationId],
    queryFn: () => screeningDetail(applicationId),
  });
  const cardsQ = useQuery({
    queryKey: ["screening", "scorecards"],
    queryFn: safe(listScreeningScorecards),
  });

  const records = detailQ.data ?? [];
  const cards = cardsQ.data ?? [];
  const draft = records.find((r) => r.status === "draft") ?? null;
  const submitted = records.filter((r) => r.status === "submitted");

  const refresh = () => qc.invalidateQueries({ queryKey: ["screening", "detail", applicationId] });

  const onStart = async () => {
    setBusy(true);
    try {
      await createScreening(applicationId, scorecardId ?? null);
      await refresh();
    } catch {
      toast.error(t("screening.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  if (detailQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("screening.common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Submitted records (read-only history) */}
      {submitted.map((r) => (
        <SubmittedSummary key={r.id} record={r} language={language} t={t} />
      ))}

      {/* Active draft → editable form */}
      {draft ? (
        <ScreeningForm applicationId={applicationId} screening={draft} onSaved={refresh} />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex w-56 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("screening.form.scorecard")}</span>
            <Select value={scorecardId} onValueChange={setScorecardId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t("screening.form.scorecard")} />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {language === "ar" ? c.name_ar : c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onStart} disabled={busy}>
            {t("screening.panel.start")}
          </Button>
        </div>
      )}

      {submitted.length === 0 && !draft && (
        <p className="text-sm text-muted-foreground">{t("screening.panel.none")}</p>
      )}
    </div>
  );
}

function SubmittedSummary({
  record,
  language,
  t,
}: {
  record: ScreeningRecord;
  language: string;
  t: (k: string) => string;
}) {
  const critName = (c: { name_en: string; name_ar: string }) =>
    language === "ar" ? c.name_ar : c.name_en;
  const who = language === "ar" ? record.screened_by_name_ar : record.screened_by_name_en;
  const rec = record.recommendation;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`screening.status.${record.status}`)}</Badge>
        {rec && (
          <Badge variant={rec === "reject" ? "destructive" : "default"}>
            {t(`screening.recommendation.${rec}`)}
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {t("screening.panel.overall")}:{" "}
          <span className="font-medium text-foreground" dir="ltr">
            {record.overall_score === null ? "—" : record.overall_score}
          </span>
        </span>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {new Date(record.screened_at).toLocaleString()}
        </span>
        {who && (
          <span className="text-xs text-muted-foreground">
            {t("screening.panel.screenedBy")}: {who}
          </span>
        )}
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {record.criteria.map((c) => (
          <li key={c.criterion_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{critName(c)}</span>
            <span className="font-medium text-foreground" dir="ltr">
              {c.score === null ? "—" : c.score} / {c.max_score}
            </span>
          </li>
        ))}
      </ul>
      {record.notes_en && <p className="text-sm text-foreground">{record.notes_en}</p>}
    </div>
  );
}
