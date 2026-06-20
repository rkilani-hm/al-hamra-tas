// Route: /app/notifications/preferences — per-channel/category preferences.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { NotificationPreferences } from "@/features/notifications/components/NotificationPreferences";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/notifications/preferences")({
  head: () => ({ meta: [{ title: "Notification Preferences — Al Hamra TAS" }] }),
  component: PreferencesPage,
});

function PreferencesPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const { currentUserId } = useAuth();

  return (
    <div className="space-y-4">
      <Link to="/app/notifications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("notifications.backToNotifications")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("notifications.prefs.pageTitle")}</h1>
      <NotificationPreferences currentUserId={currentUserId} />
    </div>
  );
}
