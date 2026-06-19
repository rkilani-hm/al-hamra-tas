// Route: /app/requisitions — Module M1.2 requisition list.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";

import { RequisitionList } from "@/features/requisition/components/RequisitionList";

export const Route = createFileRoute("/app/requisitions/")({
  head: () => ({
    meta: [
      { title: "Requisitions — Al Hamra TAS" },
      { name: "description", content: "Job requisitions and their approval status." },
    ],
  }),
  component: RequisitionsPage,
});

function RequisitionsPage() {
  const { t } = useTranslation();
  // Gated like other recipient-scoped views until Entra sign-in resolves the id.
  const currentUserId: string | null = null;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("requisition.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("requisition.page.subtitle")}</p>
        </div>
      </header>
      <RequisitionList currentUserId={currentUserId} />
    </div>
  );
}
