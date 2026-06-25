// Route: /app/offers — Module M1.9 offer list.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileSignature } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { AdapterStatus } from "@/features/offers/components/AdapterStatus";
import { listOffers, safe } from "@/features/offers/api";

export const Route = createFileRoute("/app/offers/")({
  head: () => ({
    meta: [
      { title: "Offers — Al Hamra TAS" },
      { name: "description", content: "Create and manage candidate job offers." },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canViewOffer = capabilities.includes("offer.view");

  const q = useQuery({ queryKey: ["offers", "all"], enabled: canViewOffer, queryFn: safe(() => listOffers({ limit: 50 })) });
  const offers = q.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("offers.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("offers.page.subtitle")}</p>
          </div>
        </div>
        <AdapterStatus />
      </header>

      {!canViewOffer ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("offers.detail.noViewPermission")}</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("offers.common.loading")}</p>
      ) : offers.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("offers.panel.none")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/offers/$id" params={{ id: o.id }} className="text-sm font-medium text-primary hover:underline">
                  {o.reference ?? o.id}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {(language === "ar" ? o.candidate_name_ar : o.candidate_name_en) ?? "—"}
                  {" · "}
                  {o.salary_amount != null ? `${o.salary_amount} ${o.currency}` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t(`offers.esign.${o.esign_status}`)}</Badge>
                <Badge variant="outline">{t(`offers.status.${o.status}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
