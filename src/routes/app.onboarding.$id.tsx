// Route: /app/onboarding/:id — Module M1.11 onboarding detail.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { OnboardingDetail } from "@/features/onboarding/components/OnboardingDetail";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/onboarding/$id")({
  head: () => ({ meta: [{ title: "Onboarding — Al Hamra TAS" }] }),
  component: OnboardingDetailPage,
});

function OnboardingDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/onboarding/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/onboarding" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("onboarding.backToList")}
      </Link>
      <OnboardingDetail id={id} />
    </div>
  );
}
