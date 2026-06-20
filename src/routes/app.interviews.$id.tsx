// Route: /app/interviews/:id — Module M1.7 interview detail + panelist scorecard.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { InterviewDetail } from "@/features/interviews/components/InterviewDetail";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/interviews/$id")({
  head: () => ({ meta: [{ title: "Interview — Al Hamra TAS" }] }),
  component: InterviewDetailPage,
});

function InterviewDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/interviews/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const { currentUserId } = useAuth();

  return (
    <div className="space-y-4">
      <Link to="/app/interviews" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("interviews.backToList")}
      </Link>
      <InterviewDetail id={id} currentUserId={currentUserId} />
    </div>
  );
}
