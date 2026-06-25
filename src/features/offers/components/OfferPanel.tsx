// Module M1.9 — OfferPanel: reusable <OfferPanel applicationId candidateId/>
// embedded in M1.5's ApplicationDetail (alongside Screening + Interview panels).
// Lists offers for the application + a "Create offer" CTA + per-offer status.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileSignature } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { listOffers, safe } from "../api";
import { OfferForm } from "./OfferForm";

interface OfferPanelProps {
  applicationId: string;
  candidateId?: string | null;
  currentUserId?: string | null;
}

export function OfferPanel({ applicationId, candidateId = null, currentUserId = null }: OfferPanelProps) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canViewOffer = capabilities.includes("offer.view");
  const canWriteOffer = capabilities.includes("offer.write");
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["offers", "byApplication", applicationId],
    enabled: canViewOffer,
    queryFn: safe(() => listOffers({ applicationId, limit: 50 })),
  });
  const offers = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["offers", "byApplication", applicationId] });

  if (!canViewOffer) {
    return <p className="text-sm text-muted-foreground">{t("offers.detail.noViewPermission")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!creating && candidateId && canWriteOffer && (
          <Button size="sm" className="gap-1" onClick={() => setCreating(true)}>
            <FileSignature className="h-4 w-4" /> {t("offers.actions.create")}
          </Button>
        )}
      </div>

      {creating && candidateId && (
        <OfferForm
          applicationId={applicationId}
          candidateId={candidateId}
          currentUserId={currentUserId}
          onSaved={() => { setCreating(false); refresh(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("offers.common.loading")}</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("offers.panel.none")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/offers/$id" params={{ id: o.id }} className="text-sm font-medium text-primary hover:underline">
                  {o.reference ?? o.id}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {o.salary_amount != null ? `${o.salary_amount} ${o.currency}` : "—"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {o.onboarding_ready && <Badge variant="default">{t("offers.detail.onboardingReady")}</Badge>}
                <Badge variant="outline">{t(`offers.status.${o.status}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
