// Module M0.4 — top-bar notification bell + unread badge + preview list.
// Works fully in-app with zero external deps. Polls unread_count on an interval.
// RTL: lives in the TopBar's end-aligned cluster, so it mirrors automatically.
//
// Needs the signed-in user's tas_user id. Real Entra sign-in wiring lands later,
// so `currentUserId` is null for now → the bell renders a "sign in" state.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markAllRead, myNotifications, safe, unreadCount } from "../api";

interface NotificationBellProps {
  currentUserId?: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell({ currentUserId }: NotificationBellProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const countQ = useQuery({
    queryKey: ["notifications", "unread", currentUserId],
    queryFn: () => (currentUserId ? unreadCount(currentUserId) : Promise.resolve(0)),
    enabled: Boolean(currentUserId),
    refetchInterval: 30_000, // poll every 30s (in-app, no external deps)
  });

  const listQ = useQuery({
    queryKey: ["notifications", "preview", currentUserId],
    queryFn: safe(() =>
      currentUserId ? myNotifications(currentUserId, false) : Promise.resolve([]),
    ),
    enabled: Boolean(currentUserId),
  });

  const count = countQ.data ?? 0;
  const items = (listQ.data ?? []).slice(0, 8);

  const onMarkAll = async () => {
    if (!currentUserId) return;
    try {
      await markAllRead(currentUserId);
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.bell.aria")}>
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t("notifications.bell.title")}</span>
          {currentUserId && items.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onMarkAll}>
              <CheckCheck className="h-3.5 w-3.5" />
              {t("notifications.bell.markAll")}
            </Button>
          )}
        </div>

        {!currentUserId ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("notifications.bell.signInRequired")}
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t("notifications.bell.empty")}
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {items.map((n) => {
                const inner = (
                  <div className="flex items-start gap-2 px-3 py-2 hover:bg-muted/50">
                    <span
                      className={[
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        n.read_at ? "bg-transparent" : "bg-primary",
                      ].join(" ")}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{n.subject}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground" dir="ltr">
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.deep_link ? (
                      <Link to={n.deep_link} className="block">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t px-3 py-2 text-center">
          <Link to="/app/notifications" className="text-xs text-primary hover:underline">
            {t("notifications.bell.viewAll")}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
