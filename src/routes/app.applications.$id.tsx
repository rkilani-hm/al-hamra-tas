// Route: /app/applications/:id — Module M1.5 application detail.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ApplicationDetail } from "@/features/applications/components/ApplicationDetail";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/applications/$id")({
  head: () => ({ meta: [{ title: "Application — Al Hamra TAS" }] }),
  component: ApplicationDetailPage,
});

function ApplicationDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/applications/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const currentUserId: string | null = null;

  return (
    <div className="space-y-4">
      <Link to="/app/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("applications.backToList")}
      </Link>
      <ApplicationDetail id={id} currentUserId={currentUserId} />
    </div>
  );
}
