// Module M1.10 — Pre-Boarding detail: checklist + reused M0.5 DocumentPanel.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { DocumentPanel } from "@/features/documents/components/DocumentPanel";
import { OnboardingPanel } from "@/features/onboarding/components/OnboardingPanel";
import { completePreboarding, preboardingDetail, setPreboardingItem } from "../api";
import type { ItemStatus } from "../types";

const ITEM_STATUSES: ItemStatus[] = ["pending", "collected", "verified", "waived"];

interface PreBoardingDetailProps {
  id: string;
  currentUserId?: string | null;
}

export function PreBoardingDetail({ id, currentUserId = null }: PreBoardingDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("preboarding.manage");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["preboarding", "detail", id],
    queryFn: () => preboardingDetail(id),
  });
  const data = q.data;
  const pb = data?.preboarding ?? null;
  const items = data?.items ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["preboarding", "detail", id] });

  const candName = data?.candidate
    ? (language === "ar" ? data.candidate.full_name_ar : data.candidate.full_name_en) ||
      data.candidate.full_name_en || data.candidate.email
    : "";

  const requiredDone = items.every(
    (i) => !i.required || i.status === "collected" || i.status === "verified" || i.status === "waived",
  );

  const onItemStatus = async (itemId: string, status: string, reason?: string | null) => {
    setBusy(true);
    try {
      await setPreboardingItem(itemId, status, null, reason ?? null);
      await refresh();
    } catch {
      toast.error(t("preboarding.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onComplete = async () => {
    setBusy(true);
    try {
      await completePreboarding(id);
      toast.success(t("preboarding.toasts.completed"));
      await refresh();
    } catch {
      toast.error(t("preboarding.toasts.completeError"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("preboarding.common.loading")}</p>;
  if (!pb) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("preboarding.detail.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{candName || t("preboarding.detail.title")}</h1>
          <Badge variant={pb.status === "completed" ? "default" : "outline"}>{t(`preboarding.status.${pb.status}`)}</Badge>
          {data?.application?.reference && (
            <span className="text-sm text-muted-foreground" dir="ltr">{data.application.reference}</span>
          )}
        </div>
        {pb.status !== "completed" && canManage && (
          <Button className="gap-1" onClick={onComplete} disabled={busy || !requiredDone}>
            <CheckCircle2 className="h-4 w-4" /> {t("preboarding.actions.complete")}
          </Button>
        )}
      </header>

      {/* Checklist */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("preboarding.detail.checklist")}</h3>
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{language === "ar" ? it.label_ar : it.label_en}</span>
                {it.required
                  ? <Badge variant="outline" className="text-xs">{t("preboarding.item.required")}</Badge>
                  : <Badge variant="secondary" className="text-xs">{t("preboarding.item.optional")}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {it.status === "waived" && it.waived_reason && (
                  <span className="text-xs text-muted-foreground">{it.waived_reason}</span>
                )}
                <Select value={it.status} onValueChange={(v) => onItemStatus(it.id, v)} disabled={busy || !canManage || pb.status === "completed"}>
                  <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`preboarding.itemStatus.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Documents (reused M0.5 panel, scoped to this pre-boarding record) */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("preboarding.detail.documents")}</h3>
        <DocumentPanel entityType="preboarding" entityRef={id} currentUserId={currentUserId} />
      </section>

      {/* Onboarding handoff (M1.11) — available once pre-boarding is complete */}
      {pb.status === "completed" && (
        <section className="space-y-2 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("onboarding.panel.title")}</h3>
          <OnboardingPanel preboardingId={id} applicationId={data?.application?.id ?? null} />
        </section>
      )}
    </div>
  );
}
