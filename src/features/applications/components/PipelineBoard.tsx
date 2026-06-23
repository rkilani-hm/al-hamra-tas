// Module M1.5 — kanban board: applications grouped by configurable stage columns
// (ordered by sort_order). Move via a per-card stage select (no DnD dependency;
// same functional-over-fancy approach as the M0.3 builder). RTL-mirrored.
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { listApplications, listPipelineStages, moveApplicationStage, safe } from "../api";
import type { ApplicationListRow, PipelineStage } from "../types";

interface PipelineBoardProps {
  requisitionId?: string | null;
}

export function PipelineBoard({ requisitionId = null }: PipelineBoardProps) {
  const { t } = useTranslation();
  const { language, direction } = useLanguage();
  const { capabilities } = useAuth();
  const canWriteApp = capabilities.includes("application.write");
  const qc = useQueryClient();

  const stagesQ = useQuery({ queryKey: ["applications", "stages"], queryFn: safe(listPipelineStages) });
  const appsQ = useQuery({
    queryKey: ["applications", "board", requisitionId],
    queryFn: safe(() => listApplications({ requisitionId, limit: 500 })),
  });
  const stages = stagesQ.data ?? [];
  const apps = appsQ.data ?? [];

  const stageName = (s: PipelineStage) => (language === "ar" ? s.name_ar : s.name_en);
  const candName = (r: ApplicationListRow) =>
    (language === "ar" ? r.candidate_name_ar : r.candidate_name_en) || r.candidate_name_en || "—";

  const byStage = useMemo(() => {
    const m = new Map<string, ApplicationListRow[]>();
    for (const a of apps) {
      const key = a.current_stage_id ?? "__none__";
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    }
    return m;
  }, [apps]);

  const move = async (appId: string, toStageId: string) => {
    try {
      await moveApplicationStage(appId, toStageId, null);
      toast.success(t("applications.toasts.moved"));
      await qc.invalidateQueries({ queryKey: ["applications", "board"] });
    } catch {
      toast.error(t("applications.toasts.actionError"));
    }
  };

  if (stagesQ.isLoading || appsQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("applications.common.loading")}</p>;
  }

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2"
      style={{ flexDirection: direction === "rtl" ? "row-reverse" : "row" }}
    >
      {stages.map((s) => {
        const items = byStage.get(s.id) ?? [];
        return (
          <div key={s.id} className="w-64 shrink-0 rounded-md border bg-muted/20">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium text-foreground">{stageName(s)}</span>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2 p-2">
              {items.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">{t("applications.board.emptyColumn")}</p>
              ) : (
                items.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-md border bg-background p-2">
                    <Link to="/app/applications/$id" params={{ id: a.id }} className="block text-sm font-medium text-primary hover:underline">
                      {candName(a)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.reference}</p>
                    <Select value={a.current_stage_id ?? undefined} onValueChange={(v) => move(a.id, v)} disabled={!canWriteApp}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={t("applications.board.move")} /></SelectTrigger>
                      <SelectContent>
                        {stages.map((st) => (
                          <SelectItem key={st.id} value={st.id}>{stageName(st)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
