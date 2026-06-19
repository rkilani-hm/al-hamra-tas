// Route: /app/applications — Module M1.5 application list. Honors ?requisition=<id>.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { KanbanSquare, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApplicationList } from "@/features/applications/components/ApplicationList";

export const Route = createFileRoute("/app/applications/")({
  validateSearch: (s: Record<string, unknown>): { requisition?: string } => ({
    requisition: typeof s.requisition === "string" ? s.requisition : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Applications — Al Hamra TAS" },
      { name: "description", content: "Candidate applications and the ATS pipeline." },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { t } = useTranslation();
  const { requisition } = Route.useSearch();
  const currentUserId: string | null = null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KanbanSquare className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("applications.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("applications.page.subtitle")}</p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link to="/app/applications/stages"><SlidersHorizontal className="h-4 w-4" /> {t("applications.nav.stages")}</Link>
        </Button>
      </header>
      <ApplicationList requisitionId={requisition ?? null} currentUserId={currentUserId} />
    </div>
  );
}
