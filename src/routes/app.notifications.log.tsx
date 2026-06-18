// Route: /app/notifications/log — delivery log + adapter status.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DeliveryLog } from "@/features/notifications/components/DeliveryLog";
import { AdapterStatusPanel } from "@/features/notifications/components/AdapterStatusPanel";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/app/notifications/log")({
  head: () => ({ meta: [{ title: "Delivery Log — Al Hamra TAS" }] }),
  component: LogPage,
});

function LogPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-6">
      <Link to="/app/notifications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("notifications.backToNotifications")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("notifications.log.pageTitle")}</h1>
      <AdapterStatusPanel />
      <DeliveryLog />
    </div>
  );
}
