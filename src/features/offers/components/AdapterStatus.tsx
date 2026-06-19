// Module M1.9 — AdapterStatus: e-sign provider readiness indicator. No e-sign
// provider is wired yet (dormant) — in-app recruiter-recorded acceptance works
// regardless; this surfaces the "signing pending provider config" state.
import { useTranslation } from "react-i18next";
import { PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function AdapterStatus() {
  const { t } = useTranslation();
  // No esign adapter-config channel exists yet; provider is TBD/dormant.
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("offers.adapter.title")}:</span>
      <Badge variant="secondary" className="gap-1">
        <PenLine className="h-3 w-3" />
        {t("offers.adapter.dormant")}
      </Badge>
    </div>
  );
}
