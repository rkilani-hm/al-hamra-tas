// Route: /app/assessments — Module M1.8 assessment hub: every assessment across
// the pipeline in one place, with a status filter and a deep-link into the parent
// application (where the AssessmentForm/Panel lives). Read-light by design.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { listAssessments, safe } from "@/features/assessment/api";
import type { AssessmentStatus } from "@/features/assessment/types";

export const Route = createFileRoute("/app/assessments/")({
  head: () => ({
    meta: [
      { title: "Assessments — Al Hamra TAS" },
      { name: "description", content: "Candidate assessments across the pipeline." },
    ],
  }),
  component: AssessmentsPage,
});

type Filter = "all" | AssessmentStatus;
const FILTERS: Filter[] = ["all", "draft", "submitted"];

function AssessmentsPage() {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canView = capabilities.includes("assessment.write");
  const [filter, setFilter] = useState<Filter>("all");

  const q = useQuery({
    queryKey: ["assessment", "all"],
    queryFn: safe(() => listAssessments()),
    enabled: canView,
  });
  const rows = (q.data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <FileCheck2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("assessment.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("assessment.page.subtitle")}</p>
        </div>
      </header>

      {!canView ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("assessment.noPermission")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? t("assessment.filterAll") : t(`assessment.status.${f}`)}
              </Button>
            ))}
          </div>

          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("assessment.common.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("assessment.panel.none")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {r.title || t(`assessment.type.${r.assessment_type}`)}
                    </span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.overall_score != null && (
                      <span className="text-sm font-medium text-foreground" dir="ltr">{r.overall_score}</span>
                    )}
                    {r.recommendation && <Badge variant="outline">{t(`assessment.recommendation.${r.recommendation}`)}</Badge>}
                    <Badge variant={r.status === "submitted" ? "default" : "secondary"}>{t(`assessment.status.${r.status}`)}</Badge>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/app/applications/$id" params={{ id: r.application_id }}>{t("assessment.openApplication")}</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
