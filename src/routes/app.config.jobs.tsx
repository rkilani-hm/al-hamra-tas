// Route: /app/config/jobs — job catalog (families / grades / positions).
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { JobCatalog } from "@/features/config/components/JobCatalog";
import { ConfigBackLink } from "@/features/config/components/ConfigBackLink";

export const Route = createFileRoute("/app/config/jobs")({
  head: () => ({ meta: [{ title: "Job Catalog — Al Hamra TAS" }] }),
  component: JobsPage,
});

function JobsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <ConfigBackLink />
      <h1 className="text-2xl font-semibold text-foreground">{t("config.jobs.pageTitle")}</h1>
      <JobCatalog />
    </div>
  );
}
