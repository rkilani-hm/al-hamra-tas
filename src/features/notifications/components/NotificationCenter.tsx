// Module M0.4 — full in-app notification list. Mark read on open; filter unread.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCheck, Mail, MailOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markAllRead, markRead, myNotifications, safe } from "../api";

interface NotificationCenterProps {
  currentUserId?: string | null;
}

export function NotificationCenter({ currentUserId }: NotificationCenterProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const q = useQuery({
    queryKey: ["notifications", "center", currentUserId, unreadOnly],
    queryFn: safe(() =>
      currentUserId ? myNotifications(currentUserId, unreadOnly) : Promise.resolve([]),
    ),
    enabled: Boolean(currentUserId),
  });
  const items = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const onRead = async (id: string) => {
    try {
      await markRead(id);
      await refresh();
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };
  const onMarkAll = async () => {
    if (!currentUserId) return;
    try {
      await markAllRead(currentUserId);
      await refresh();
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };

  if (!currentUserId) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("notifications.center.signInRequired")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant={unreadOnly ? "outline" : "default"} size="sm" onClick={() => setUnreadOnly(false)}>
            {t("notifications.center.all")}
          </Button>
          <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly(true)}>
            {t("notifications.center.unread")}
          </Button>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={onMarkAll}>
            <CheckCheck className="h-4 w-4" /> {t("notifications.bell.markAll")}
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("notifications.common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("notifications.center.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {items.map((n) => (
            <li key={n.id} className={n.read_at ? "" : "bg-primary/5"}>
              <div className="flex items-start gap-3 p-3">
                {n.read_at ? (
                  <MailOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                ) : (
                  <Mail className="mt-0.5 h-4 w-4 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{n.subject}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                    {n.deep_link && (
                      <Link to={n.deep_link} className="text-xs text-primary hover:underline">
                        {t("notifications.center.open")}
                      </Link>
                    )}
                  </div>
                </div>
                {!n.read_at && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => onRead(n.id)}>
                    {t("notifications.center.markRead")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
