// Route: /app/offers/new — Module M1.9 create-offer form. Expects ?application
// and ?candidate (offers are created from an application context).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { OfferForm } from "@/features/offers/components/OfferForm";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/offers/new")({
  validateSearch: (s: Record<string, unknown>): { application?: string; candidate?: string } => ({
    application: typeof s.application === "string" ? s.application : undefined,
    candidate: typeof s.candidate === "string" ? s.candidate : undefined,
  }),
  head: () => ({ meta: [{ title: "New Offer — Al Hamra TAS" }] }),
  component: NewOfferPage,
});

function NewOfferPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { application, candidate } = Route.useSearch();
  const navigate = useNavigate();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const { currentUserId } = useAuth();

  return (
    <div className="space-y-4">
      <Link to="/app/offers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("offers.backToList")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("offers.page.new")}</h1>
      {application && candidate ? (
        <OfferForm
          applicationId={application}
          candidateId={candidate}
          currentUserId={currentUserId}
          onSaved={(id) => navigate({ to: "/app/offers/$id", params: { id } })}
        />
      ) : (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("offers.page.needContext")}
        </p>
      )}
    </div>
  );
}
