// Module M0.4 — delivery log: recipient, type, channel, status, time, error.
// Filter by status/channel; retry action (service-role until M3.1 → fails-soft).
// 'skipped (adapter unconfigured)' is shown clearly so ops can see what's pending.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listDeliveryLog, retryNotification, safe } from "../api";
import { CHANNELS, type NotificationStatus } from "../types";

const STATUS_VARIANT: Record<
  NotificationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  sent: "default",
  queued: "secondary",
  skipped: "outline",
  failed: "destructive",
  failed_terminal: "destructive",
};

const STATUSES: NotificationStatus[] = ["queued", "sent", "skipped", "failed", "failed_terminal"];
const ALL = "__all__";

export function DeliveryLog() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(ALL);
  const [channel, setChannel] = useState<string>(ALL);

  const q = useQuery({
    queryKey: ["notifications", "log", status, channel],
    queryFn: safe(() =>
      listDeliveryLog({
        status: status === ALL ? undefined : status,
        channel: channel === ALL ? undefined : channel,
      }),
    ),
  });
  const rows = q.data ?? [];

  const retry = async (id: string) => {
    try {
      await retryNotification(id);
      toast.success(t("notifications.toasts.retried"));
      await qc.invalidateQueries({ queryKey: ["notifications", "log"] });
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2 sm:w-48">
          <span className="text-xs text-muted-foreground">{t("notifications.log.filterStatus")}</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("notifications.log.allStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`notifications.deliveryStatus.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <span className="text-xs text-muted-foreground">{t("notifications.log.filterChannel")}</span>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("notifications.log.allChannels")}</SelectItem>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{t(`notifications.channel.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("notifications.log.type")}</TableHead>
              <TableHead className="text-start">{t("notifications.log.channel")}</TableHead>
              <TableHead className="text-start">{t("notifications.log.status")}</TableHead>
              <TableHead className="text-start">{t("notifications.log.time")}</TableHead>
              <TableHead className="text-start">{t("notifications.log.error")}</TableHead>
              <TableHead className="text-end">{t("notifications.log.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                  {t("notifications.log.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">
                    {t(`notifications.typeCode.${n.type_code}`, { defaultValue: n.type_code })}
                  </TableCell>
                  <TableCell><Badge variant="outline">{t(`notifications.channel.${n.channel}`)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[n.status]}>
                      {t(`notifications.deliveryStatus.${n.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {new Date(n.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={n.error_text ?? ""}>
                    {n.error_text ?? "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    {(n.status === "failed" || n.status === "failed_terminal") && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("notifications.log.retry")} onClick={() => retry(n.id)}>
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
