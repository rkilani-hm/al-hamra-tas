// Route: /app/notifications — Module M0.4 notification center.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bell, ListChecks, Settings2, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";

export const Route = createFileRoute("/app/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications — Al Hamra TAS" },
      { name: "description", content: "Your notifications and communication settings." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useTranslation();
  // Gated like the workflow inbox until Entra sign-in resolves the tas_user id.
  const currentUserId: string | null = null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("notifications.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("notifications.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/app/notifications/preferences"><SlidersHorizontal className="h-4 w-4" /> {t("notifications.nav.preferences")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/app/notifications/templates"><Settings2 className="h-4 w-4" /> {t("notifications.nav.templates")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/app/notifications/log"><ListChecks className="h-4 w-4" /> {t("notifications.nav.log")}</Link>
          </Button>
        </div>
      </header>

      <NotificationCenter currentUserId={currentUserId} />
    </div>
  );
}
