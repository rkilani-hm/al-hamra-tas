// Route: /app/screening — Module M1.6 screening queue: applications currently in
// the screening stage, with quick links into the application (where the
// ScreeningPanel lives). Light by design; the screening itself happens in detail.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { listApplications, listPipelineStages, safe } from "@/features/applications/api";

export const Route = createFileRoute("/app/screening/")({
  head: () => ({
    meta: [
      { title: "Screening — Al Hamra TAS" },
      { name: "description", content: "Screen and shortlist candidate applications." },
    ],
  }),
  component: ScreeningQueuePage,
});

function ScreeningQueuePage() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const stagesQ = useQuery({ queryKey: ["applications", "stages"], queryFn: safe(listPipelineStages) });
  const screeningStage = (stagesQ.data ?? []).find((s) => s.code === "screening");

  const appsQ = useQuery({
    queryKey: ["screening", "queue", screeningStage?.id ?? null],
    queryFn: () => listApplications({ stageId: screeningStage?.id ?? null, status: "active", limit: 100 }),
    enabled: !!screeningStage,
  });
  const apps = appsQ.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("screening.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("screening.page.subtitle")}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/app/screening/scorecards">
            <SlidersHorizontal className="h-4 w-4" /> {t("screening.config.title")}
          </Link>
        </Button>
      </header>

      {stagesQ.isLoading || appsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("screening.common.loading")}</p>
      ) : apps.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("screening.panel.none")}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/applications/$id" params={{ id: a.id }} className="text-sm font-medium text-primary hover:underline">
                  {a.reference ?? a.id}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {(language === "ar" ? a.candidate_name_ar : a.candidate_name_en) ?? a.requisition_reference ?? "—"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {new Date(a.applied_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
