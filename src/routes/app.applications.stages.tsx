// Route: /app/applications/stages — Module M1.5 pipeline stage config.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { StageConfig } from "@/features/applications/components/StageConfig";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/applications/stages")({
  head: () => ({ meta: [{ title: "Pipeline Stages — Al Hamra TAS" }] }),
  component: StagesPage,
});

function StagesPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("applications.backToList")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("applications.stages.pageTitle")}</h1>
      <StageConfig />
    </div>
  );
}
