// Module M1.7 — AdapterStatus: surfaces Outlook/Teams scheduling readiness
// (reuses the M0.4 tas_comm_adapter_config read). Drives the "in-app works,
// calendar pending credentials" visibility.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarCheck, CalendarX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listAdapters } from "@/features/notifications/api";
import { safe } from "../api";

export function AdapterStatus() {
  const { t } = useTranslation();
  const adaptersQ = useQuery({ queryKey: ["notifications", "adapters"], queryFn: safe(listAdapters) });
  const adapters = adaptersQ.data ?? [];

  const channel = (code: "outlook_email" | "teams") => {
    const a = adapters.find((x) => x.channel === code);
    return !!a && a.is_enabled && a.config_status === "configured";
  };
  const outlook = channel("outlook_email");
  const teams = channel("teams");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("interviews.adapter.title")}:</span>
      <Badge variant={outlook ? "default" : "secondary"} className="gap-1">
        {outlook ? <CalendarCheck className="h-3 w-3" /> : <CalendarX className="h-3 w-3" />}
        {t("interviews.adapter.outlook")}
      </Badge>
      <Badge variant={teams ? "default" : "secondary"} className="gap-1">
        {teams ? <CalendarCheck className="h-3 w-3" /> : <CalendarX className="h-3 w-3" />}
        {t("interviews.adapter.teams")}
      </Badge>
      {!outlook && !teams && (
        <span className="text-xs text-muted-foreground">{t("interviews.adapter.dormant")}</span>
      )}
    </div>
  );
}
