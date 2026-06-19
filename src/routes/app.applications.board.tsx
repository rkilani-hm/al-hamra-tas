// Route: /app/applications/board — Module M1.5 pipeline board.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PipelineBoard } from "@/features/applications/components/PipelineBoard";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/applications/board")({
  head: () => ({ meta: [{ title: "Pipeline Board — Al Hamra TAS" }] }),
  component: BoardPage,
});

function BoardPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("applications.backToList")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("applications.board.title")}</h1>
      <PipelineBoard />
    </div>
  );
}
