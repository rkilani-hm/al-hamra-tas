// Route: /app/admin/integrations — Module M2.3 Microsoft 365 Integration.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { m365Status, setAdapterEnabled, type M365Component } from "@/features/integrations/api";

export const Route = createFileRoute("/app/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — Al Hamra TAS" }] }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("settings.manage");
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["integrations", "m365"], queryFn: m365Status, enabled: canManage });
  const s = q.data ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["integrations", "m365"] });

  const toggle = async (c: M365Component) => {
    if (!c.provider) return;
    try {
      await setAdapterEnabled(c.kind, c.provider, !c.is_enabled);
      toast.success(t("integrations.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("integrations.toasts.actionError"));
    }
  };

  if (!canManage) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("integrations.noPermission")}</p>;
  }

  const cards: { key: string; label: string; comp: M365Component | null | undefined; live?: boolean }[] = [
    { key: "entra", label: t("integrations.m365.entra"), comp: s?.entra, live: true },
    { key: "outlook", label: t("integrations.m365.outlook"), comp: s?.outlook },
    { key: "teams", label: t("integrations.m365.teams"), comp: s?.teams },
    { key: "sharepoint", label: t("integrations.m365.sharepoint"), comp: s?.sharepoint },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Plug className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("integrations.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("integrations.page.subtitle")}</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const enabled = c.live || c.comp?.is_enabled;
          return (
            <div key={c.key} className="flex items-center justify-between rounded-md border p-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{c.label}</span>
                <Badge variant={enabled ? "default" : "outline"} className="mt-1 w-fit">
                  {c.live ? t("integrations.status.live") : c.comp?.is_enabled ? t("integrations.status.enabled") : t("integrations.status.dormant")}
                </Badge>
              </div>
              {!c.live && c.comp && (
                <Button variant="outline" size="sm" onClick={() => toggle(c.comp!)}>
                  {c.comp.is_enabled ? t("integrations.actions.disable") : t("integrations.actions.enable")}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("integrations.secretsNote")}</p>
    </div>
  );
}
