// Route: /app/requisitions/:id — Module M1.2 requisition detail.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequisitionDetail } from "@/features/requisition/components/RequisitionDetail";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/requisitions/$id")({
  head: () => ({ meta: [{ title: "Requisition — Al Hamra TAS" }] }),
  component: RequisitionDetailPage,
});

function RequisitionDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/requisitions/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const currentUserId: string | null = null;

  return (
    <div className="space-y-4">
      <Link to="/app/requisitions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("requisition.backToList")}
      </Link>
      <RequisitionDetail id={id} currentUserId={currentUserId} />
    </div>
  );
}
