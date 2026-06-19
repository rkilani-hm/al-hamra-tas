// Route: /app/screening/scorecards — Module M1.6 scorecard configuration.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ScorecardConfig } from "@/features/screening/components/ScorecardConfig";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/screening/scorecards")({
  head: () => ({ meta: [{ title: "Screening Scorecards — Al Hamra TAS" }] }),
  component: ScorecardsPage,
});

function ScorecardsPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/screening" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("screening.page.title")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("screening.config.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("screening.config.subtitle")}</p>
      </div>
      <ScorecardConfig />
    </div>
  );
}
