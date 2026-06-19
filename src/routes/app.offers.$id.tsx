// Route: /app/offers/:id — Module M1.9 offer detail (edit when draft).
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { OfferDetail } from "@/features/offers/components/OfferDetail";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/offers/$id")({
  head: () => ({ meta: [{ title: "Offer — Al Hamra TAS" }] }),
  component: OfferDetailPage,
});

function OfferDetailPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { id } = useParams({ from: "/app/offers/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const currentUserId: string | null = null; // Entra sign-in wired last.

  return (
    <div className="space-y-4">
      <Link to="/app/offers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("offers.backToList")}
      </Link>
      <OfferDetail id={id} currentUserId={currentUserId} />
    </div>
  );
}
