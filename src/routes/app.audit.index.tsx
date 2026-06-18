// Route: /app/audit — Module M0.5 unified audit viewer.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";

import { AuditViewer } from "@/features/audit/components/AuditViewer";

export const Route = createFileRoute("/app/audit/")({
  head: () => ({
    meta: [
      { title: "Audit Log — Al Hamra TAS" },
      { name: "description", content: "Searchable unified audit log." },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ScrollText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("audit.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("audit.page.subtitle")}</p>
        </div>
      </header>
      <AuditViewer />
    </div>
  );
}
