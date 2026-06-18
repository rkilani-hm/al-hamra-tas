// Module M0.4 — per-channel × per-category notification preferences.
// Row absence = enabled. in_app is mandatory (locked on). External channels are
// user-toggleable. Writes go to the user's own pref rows (own-row RLS).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { listPrefs, safe, setPref } from "../api";
import { CHANNELS, PREF_CATEGORIES, type Channel } from "../types";

interface NotificationPreferencesProps {
  currentUserId?: string | null;
}

// in_app is always-on; the rest are opt-out.
const MANDATORY_CHANNELS: Channel[] = ["in_app"];

export function NotificationPreferences({ currentUserId }: NotificationPreferencesProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notifications", "prefs", currentUserId],
    queryFn: safe(() => (currentUserId ? listPrefs(currentUserId) : Promise.resolve([]))),
    enabled: Boolean(currentUserId),
  });
  const prefs = q.data ?? [];

  const isEnabled = (channel: string, category: string) => {
    if (MANDATORY_CHANNELS.includes(channel as Channel)) return true;
    const row = prefs.find((p) => p.channel === channel && p.type_category === category);
    return row ? row.enabled : true; // absence = enabled
  };

  const toggle = async (channel: string, category: string, next: boolean) => {
    if (!currentUserId) return;
    try {
      await setPref({ user_id: currentUserId, channel, type_category: category, enabled: next });
      await qc.invalidateQueries({ queryKey: ["notifications", "prefs", currentUserId] });
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };

  if (!currentUserId) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("notifications.prefs.signInRequired")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("notifications.prefs.intro")}</p>

      {PREF_CATEGORIES.map((category) => (
        <div key={category} className="space-y-2">
          <h3 className="font-medium text-foreground">{t(`notifications.category.${category}`)}</h3>
          <div className="divide-y rounded-md border">
            {CHANNELS.map((channel) => {
              const mandatory = MANDATORY_CHANNELS.includes(channel);
              return (
                <div key={channel} className="flex items-center justify-between p-3">
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{t(`notifications.channel.${channel}`)}</span>
                    {mandatory && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" /> {t("notifications.prefs.mandatory")}
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={isEnabled(channel, category)}
                    disabled={mandatory}
                    onCheckedChange={(v) => toggle(channel, category, v)}
                    aria-label={`${channel} ${category}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
