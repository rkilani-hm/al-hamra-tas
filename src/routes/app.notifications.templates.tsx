// Route: /app/notifications/templates — template admin.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TemplateAdmin } from "@/features/notifications/components/TemplateAdmin";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/notifications/templates")({
  head: () => ({ meta: [{ title: "Notification Templates — Al Hamra TAS" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/notifications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("notifications.backToNotifications")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("notifications.template.pageTitle")}</h1>
      <TemplateAdmin />
    </div>
  );
}
