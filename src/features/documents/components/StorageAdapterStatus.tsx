// Module M0.5 — read-only storage adapter status. Shows SharePoint
// configured/unconfigured and surfaces the active fallback to Supabase Storage.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleSlash, HardDrive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listStorageAdapters, safe } from "../api";

export function StorageAdapterStatus() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["documents", "adapters"], queryFn: safe(listStorageAdapters) });
  const adapters = q.data ?? [];

  const sharepoint = adapters.find((a) => a.provider === "sharepoint");
  const usingFallback = !sharepoint?.is_enabled || sharepoint?.config_status !== "configured";

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">{t("documents.adapters.title")}</h3>
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
                  {t(`documents.provider.${a.provider}`)}
                </span>
                {a.notes && <span className="text-xs text-muted-foreground">{a.notes}</span>}
              </div>
              <Badge variant={live ? "default" : "secondary"}>
                {live ? t("documents.adapters.live") : t(`documents.adapterStatus.${a.config_status}`)}
              </Badge>
            </div>
          );
        })}
      </div>
      {usingFallback && (
        <p className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          <HardDrive className="h-4 w-4" />
          {t("documents.adapters.usingFallback")}
        </p>
      )}
    </div>
  );
}
