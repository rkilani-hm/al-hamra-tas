// Route: /app/preboarding/:id — Module M1.10 pre-boarding detail.
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PreBoardingDetail } from "@/features/preboarding/components/PreBoardingDetail";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/preboarding/$id")({
  head: () => ({ meta: [{ title: "Pre-Boarding — Al Hamra TAS" }] }),
  component: PreBoardingDetailPage,
});

function PreBoardingDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/preboarding/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const { currentUserId } = useAuth();

  return (
    <div className="space-y-4">
      <Link to="/app/preboarding" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("preboarding.backToList")}
      </Link>
      <PreBoardingDetail id={id} currentUserId={currentUserId} />
    </div>
  );
}
