// Route: /app/requisitions/new — Module M1.2 create requisition.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { RequisitionForm } from "@/features/requisition/components/RequisitionForm";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/requisitions/new")({
  head: () => ({ meta: [{ title: "New Requisition — Al Hamra TAS" }] }),
  component: NewRequisitionPage,
});

function NewRequisitionPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const currentUserId: string | null = null;

  return (
    <div className="space-y-4">
      <Link to="/app/requisitions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("requisition.backToList")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("requisition.form.newTitle")}</h1>
      <RequisitionForm currentUserId={currentUserId} />
    </div>
  );
}
