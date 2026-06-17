// Route: /app/config/lookups — reference lookups manager.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LookupManager } from "@/features/config/components/LookupManager";
import { ConfigBackLink } from "@/features/config/components/ConfigBackLink";

export const Route = createFileRoute("/app/config/lookups")({
  head: () => ({ meta: [{ title: "Lookups — Al Hamra TAS" }] }),
  component: LookupsPage,
});

function LookupsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <ConfigBackLink />
      <h1 className="text-2xl font-semibold text-foreground">{t("config.lookups.pageTitle")}</h1>
      <LookupManager />
    </div>
  );
}
