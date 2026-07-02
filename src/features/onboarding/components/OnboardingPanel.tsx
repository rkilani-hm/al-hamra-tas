// Module M1.11 — OnboardingPanel: embedded in PreBoardingDetail once pre-boarding
// is complete. Starts onboarding (gated) or links to the existing record.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { listOnboarding, safe, startOnboarding } from "../api";

interface OnboardingPanelProps {
  preboardingId: string;
  applicationId?: string | null;
}

export function OnboardingPanel({ preboardingId, applicationId = null }: OnboardingPanelProps) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("onboarding.manage");
  const [busy, setBusy] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["onboarding", "byApplication", applicationId],
    queryFn: safe(() => listOnboarding()),
  });
  const existing = (q.data ?? []).find((r) => r.application_id === applicationId) ?? null;
  const obId = existing?.id ?? startedId;

  const onStart = async () => {
    setBusy(true);
    try {
      const id = await startOnboarding(preboardingId);
      setStartedId(id);
      toast.success(t("onboarding.toasts.started"));
    } catch {
      toast.error(t("onboarding.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        {existing
          ? <Badge variant={existing.status === "completed" ? "default" : "outline"}>{t(`onboarding.status.${existing.status}`)}</Badge>
          : <span className="text-sm text-muted-foreground">{t("onboarding.panel.notStarted")}</span>}
      </div>
      <div className="flex items-center gap-2">
        {obId
          ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/app/onboarding/$id" params={{ id: obId }}>{t("onboarding.panel.open")}</Link>
            </Button>
          )
          : canManage && (
            <Button size="sm" onClick={onStart} disabled={busy}>{t("onboarding.actions.start")}</Button>
          )}
      </div>
    </div>
  );
}
