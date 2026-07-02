// Module M3.1 (consent) — ConsentPanel embedded in the candidate detail.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { listCandidateConsents, recordConsent } from "../api";
import type { ConsentType } from "../types";

const CONSENT_TYPES: ConsentType[] = ["data_processing", "background_check", "data_retention", "marketing"];

interface ConsentPanelProps {
  candidateId: string;
}

export function ConsentPanel({ candidateId }: ConsentPanelProps) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("consent.manage");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["consent", candidateId], queryFn: () => listCandidateConsents(candidateId) });
  const rows = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["consent", candidateId] });

  const set = async (type: string, granted: boolean) => {
    setBusy(true);
    try {
      await recordConsent(candidateId, type, granted);
      toast.success(t("consent.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("consent.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ul className="divide-y rounded-md border">
      {CONSENT_TYPES.map((ct) => {
        const row = rows.find((r) => r.consent_type === ct);
        const granted = row?.granted ?? false;
        return (
          <li key={ct} className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{t(`consent.type.${ct}`)}</span>
              {row?.retention_until && (
                <span className="text-xs text-muted-foreground" dir="ltr">{t("consent.retentionUntil")}: {row.retention_until}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={granted ? "default" : "outline"}>
                {granted ? t("consent.granted") : row?.withdrawn_at ? t("consent.withdrawn") : t("consent.notRecorded")}
              </Badge>
              {canManage && (
                granted
                  ? <Button variant="outline" size="sm" onClick={() => set(ct, false)} disabled={busy}>{t("consent.actions.withdraw")}</Button>
                  : <Button size="sm" onClick={() => set(ct, true)} disabled={busy}>{t("consent.actions.grant")}</Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
