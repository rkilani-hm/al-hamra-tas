// Module M1.10 — PreBoardingPanel: embedded in ApplicationDetail for hired
// applications. Starts pre-boarding (gated) or links to the existing record.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { listPreboarding, safe, startPreboarding } from "../api";

interface PreBoardingPanelProps {
  applicationId: string;
}

export function PreBoardingPanel({ applicationId }: PreBoardingPanelProps) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("preboarding.manage");
  const [busy, setBusy] = useState(false);
  const [startedId, setStartedId] = useState<string | null>(null);

  // Reuse list_preboarding (open read) filtered client-side to this application.
  const q = useQuery({
    queryKey: ["preboarding", "byApplication", applicationId],
    queryFn: safe(() => listPreboarding()),
  });
  const existing = (q.data ?? []).find((r) => r.application_id === applicationId) ?? null;
  const pbId = existing?.id ?? startedId;

  const onStart = async () => {
    setBusy(true);
    try {
      const id = await startPreboarding(applicationId);
      setStartedId(id);
      toast.success(t("preboarding.toasts.started"));
    } catch {
      toast.error(t("preboarding.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        {existing
          ? <Badge variant={existing.status === "completed" ? "default" : "outline"}>{t(`preboarding.status.${existing.status}`)}</Badge>
          : <span className="text-sm text-muted-foreground">{t("preboarding.panel.notStarted")}</span>}
      </div>
      <div className="flex items-center gap-2">
        {pbId
          ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/app/preboarding/$id" params={{ id: pbId }}>{t("preboarding.panel.open")}</Link>
            </Button>
          )
          : canManage && (
            <Button size="sm" onClick={onStart} disabled={busy}>{t("preboarding.actions.start")}</Button>
          )}
      </div>
    </div>
  );
}
