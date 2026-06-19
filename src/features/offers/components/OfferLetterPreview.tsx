// Module M1.9 — OfferLetterPreview: renders the frozen bilingual letter snapshot.
import { useTranslation } from "react-i18next";

import type { OfferLetterSnapshot } from "../types";

interface OfferLetterPreviewProps {
  snapshot: OfferLetterSnapshot | null;
}

export function OfferLetterPreview({ snapshot }: OfferLetterPreviewProps) {
  const { t } = useTranslation();

  if (!snapshot || (!snapshot.body_en && !snapshot.body_ar)) {
    return <p className="text-sm text-muted-foreground">{t("offers.letter.notIssued")}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="space-y-2" dir="ltr">
        <h4 className="font-medium text-foreground">{snapshot.title_en ?? "Offer of Employment"}</h4>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{snapshot.body_en}</p>
        {snapshot.terms_en && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{snapshot.terms_en}</p>}
      </article>
      <article className="space-y-2" dir="rtl">
        <h4 className="font-medium text-foreground">{snapshot.title_ar ?? "عرض عمل"}</h4>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{snapshot.body_ar}</p>
        {snapshot.terms_ar && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{snapshot.terms_ar}</p>}
      </article>
    </div>
  );
}
