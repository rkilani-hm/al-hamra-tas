// Route: /app/config/org — organization hierarchy (Entity → Branch → Department).
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { OrgTree } from "@/features/config/components/OrgTree";
import { ConfigBackLink } from "@/features/config/components/ConfigBackLink";

export const Route = createFileRoute("/app/config/org")({
  head: () => ({ meta: [{ title: "Organization — Al Hamra TAS" }] }),
  component: OrgPage,
});

function OrgPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <ConfigBackLink />
      <h1 className="text-2xl font-semibold text-foreground">{t("config.org.pageTitle")}</h1>
      <OrgTree />
    </div>
  );
}
