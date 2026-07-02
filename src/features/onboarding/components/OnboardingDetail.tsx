// Module M1.11 — Onboarding detail: MenaME handoff (dormant) + complete.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { completeOnboarding, handoffToMename, onboardingDetail } from "../api";

interface OnboardingDetailProps {
  id: string;
}

export function OnboardingDetail({ id }: OnboardingDetailProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("onboarding.manage");
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState("");

  const q = useQuery({ queryKey: ["onboarding", "detail", id], queryFn: () => onboardingDetail(id) });
  const data = q.data;
  const ob = data?.onboarding ?? null;
  const adapterEnabled = data?.adapter?.is_enabled ?? false;

  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding", "detail", id] });

  const candName = data?.candidate
    ? (language === "ar" ? data.candidate.full_name_ar : data.candidate.full_name_en) || data.candidate.full_name_en || data.candidate.email
    : "";

  const onHandoff = async () => {
    setBusy(true);
    try {
      const r = await handoffToMename(id);
      toast.success(r.adapter_enabled ? t("onboarding.toasts.handedOff") : t("onboarding.toasts.queued"));
      await refresh();
    } catch {
      toast.error(t("onboarding.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onComplete = async () => {
    setBusy(true);
    try {
      await completeOnboarding(id, ref.trim() || null);
      toast.success(t("onboarding.toasts.completed"));
      await refresh();
    } catch {
      toast.error(t("onboarding.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("onboarding.common.loading")}</p>;
  if (!ob) return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("onboarding.detail.notFound")}</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{candName || t("onboarding.detail.title")}</h1>
          <Badge variant={ob.status === "completed" ? "default" : "outline"}>{t(`onboarding.status.${ob.status}`)}</Badge>
          <Badge variant="secondary">{t(`onboarding.handoff.${ob.handoff_status}`)}</Badge>
        </div>
      </header>

      {/* MenaME adapter status */}
      <section className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-foreground">{t("onboarding.detail.handoffTitle")}</h3>
          <Badge variant={adapterEnabled ? "default" : "outline"}>
            {adapterEnabled ? t("onboarding.adapter.enabled") : t("onboarding.adapter.dormant")}
          </Badge>
        </div>
        {!adapterEnabled && <p className="text-xs text-muted-foreground">{t("onboarding.detail.dormantNote")}</p>}
        {ob.status !== "completed" && canManage && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button className="gap-1" variant="outline" onClick={onHandoff} disabled={busy}>
              <Send className="h-4 w-4" /> {t("onboarding.actions.handoff")}
            </Button>
          </div>
        )}
      </section>

      {/* Payload preview */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("onboarding.detail.payload")}</h3>
        <pre dir="ltr" className="overflow-x-auto rounded bg-muted/40 p-3 text-xs text-muted-foreground">
          {JSON.stringify(ob.handoff_payload, null, 2)}
        </pre>
      </section>

      {/* Complete */}
      {ob.status !== "completed" && canManage && (
        <section className="space-y-2 rounded-md border p-4">
          <h3 className="font-medium text-foreground">{t("onboarding.detail.completeTitle")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t("onboarding.detail.menameRef")}</span>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} className="h-9 w-56" dir="ltr" />
            </div>
            <Button className="gap-1" onClick={onComplete} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> {t("onboarding.actions.complete")}
            </Button>
          </div>
        </section>
      )}

      {ob.mename_employee_ref && (
        <p className="text-sm text-muted-foreground">
          {t("onboarding.detail.menameRef")}: <span dir="ltr" className="font-medium text-foreground">{ob.mename_employee_ref}</span>
        </p>
      )}
    </div>
  );
}
