// Module M1.7 — InterviewPanel: reusable <InterviewPanel applicationId/> embedded
// in M1.5's ApplicationDetail. Lists this application's interviews + a "Schedule
// interview" CTA + per-interview status/outcome with a link to the detail page.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CalendarPlus, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { listInterviews, safe } from "../api";
import { AdapterStatus } from "./AdapterStatus";
import { InterviewScheduleForm } from "./InterviewScheduleForm";

interface InterviewPanelProps {
  applicationId: string;
}

export function InterviewPanel({ applicationId }: InterviewPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [scheduling, setScheduling] = useState(false);

  const q = useQuery({
    queryKey: ["interviews", "byApplication", applicationId],
    queryFn: safe(() => listInterviews({ applicationId, limit: 50 })),
  });
  const interviews = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["interviews", "byApplication", applicationId] });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AdapterStatus />
        {!scheduling && (
          <Button size="sm" className="gap-1" onClick={() => setScheduling(true)}>
            <CalendarPlus className="h-4 w-4" /> {t("interviews.actions.schedule")}
          </Button>
        )}
      </div>

      {scheduling && (
        <InterviewScheduleForm
          applicationId={applicationId}
          onScheduled={() => { setScheduling(false); refresh(); }}
          onCancel={() => setScheduling(false)}
        />
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("interviews.common.loading")}</p>
      ) : interviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("interviews.panel.none")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {interviews.map((iv) => (
            <li key={iv.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/interviews/$id" params={{ id: iv.id }} className="text-sm font-medium text-primary hover:underline">
                  {iv.reference ?? iv.id}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : t("interviews.panel.unscheduled")}
                  {" · "}{t(`interviews.mode.${iv.mode}`)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {iv.teams_join_url && (
                  <a href={iv.teams_join_url} target="_blank" rel="noreferrer" className="text-primary hover:underline" title={t("interviews.detail.joinTeams")}>
                    <Video className="h-4 w-4" />
                  </a>
                )}
                <Badge variant="outline">{t(`interviews.status.${iv.status}`)}</Badge>
                {iv.outcome && (
                  <Badge variant={iv.outcome === "reject" ? "destructive" : "default"}>
                    {t(`interviews.outcome.${iv.outcome}`)}
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
