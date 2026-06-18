// Module M0.4 — read-only adapter status. Shows which channels are live vs
// pending credentials (drives "in-app works, email pending" visibility).
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleSlash } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listAdapters, safe } from "../api";

export function AdapterStatusPanel() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["notifications", "adapters"], queryFn: safe(listAdapters) });
  const adapters = q.data ?? [];

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">{t("notifications.adapters.title")}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {adapters.map((a) => {
          const live = a.is_enabled && a.config_status === "configured";
          return (
            <div key={a.id} className="flex items-start justify-between rounded-md border p-3">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  {live ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <CircleSlash className="h-4 w-4 text-muted-foreground" />
                  )}
                  {t(`notifications.channel.${a.channel}`)}
                </span>
                {a.notes && <span className="text-xs text-muted-foreground">{a.notes}</span>}
              </div>
              <Badge variant={live ? "default" : "secondary"}>
                {live
                  ? t("notifications.adapters.live")
                  : t(`notifications.adapterStatus.${a.config_status}`)}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
