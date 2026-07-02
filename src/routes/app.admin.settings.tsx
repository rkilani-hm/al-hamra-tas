// Route: /app/admin/settings — Module M3.2 Admin & System Settings.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/AuthProvider";
import { listAdapters, listSystemSettings, safe, setAdapterEnabled, setSystemSetting } from "@/features/settings/api";

export const Route = createFileRoute("/app/admin/settings")({
  head: () => ({ meta: [{ title: "System Settings — Al Hamra TAS" }] }),
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("settings.manage");
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const settingsQ = useQuery({ queryKey: ["settings", "list"], queryFn: safe(() => listSystemSettings()), enabled: canManage });
  const adaptersQ = useQuery({ queryKey: ["settings", "adapters"], queryFn: safe(() => listAdapters()), enabled: canManage });
  const settings = settingsQ.data ?? [];
  const adapters = adaptersQ.data ?? [];

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const s of settings) init[s.key] = JSON.stringify(s.value);
    setEdits((prev) => (Object.keys(prev).length ? prev : init));
  }, [settings]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["settings"] });

  const save = async (key: string) => {
    try {
      const raw = edits[key] ?? "";
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = raw; }
      await setSystemSetting(key, parsed);
      toast.success(t("settings.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("settings.toasts.actionError"));
    }
  };

  const toggle = async (kind: string, provider: string, enabled: boolean) => {
    try {
      await setAdapterEnabled(kind, provider, enabled);
      toast.success(t("settings.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("settings.toasts.actionError"));
    }
  };

  if (!canManage) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("settings.noPermission")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("settings.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.page.subtitle")}</p>
        </div>
      </header>

      {/* System settings */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("settings.section.general")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("settings.table.key")}</TableHead>
              <TableHead className="text-start">{t("settings.table.value")}</TableHead>
              <TableHead className="text-end">{t("settings.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((s) => (
              <TableRow key={s.key}>
                <TableCell className="font-medium" dir="ltr">{s.key}</TableCell>
                <TableCell>
                  <Input dir="ltr" value={edits[s.key] ?? ""} onChange={(e) => setEdits((p) => ({ ...p, [s.key]: e.target.value }))} />
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="outline" size="sm" onClick={() => save(s.key)}>{t("settings.actions.save")}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Integration adapters */}
      <section className="space-y-2 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("settings.section.adapters")}</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("settings.table.kind")}</TableHead>
              <TableHead className="text-start">{t("settings.table.provider")}</TableHead>
              <TableHead className="text-start">{t("settings.table.status")}</TableHead>
              <TableHead className="text-end">{t("settings.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adapters.map((a) => (
              <TableRow key={`${a.kind}:${a.provider}`}>
                <TableCell>{t(`settings.kind.${a.kind}`)}</TableCell>
                <TableCell className="font-medium" dir="ltr">{a.provider}</TableCell>
                <TableCell>
                  <Badge variant={a.is_enabled ? "default" : "outline"}>
                    {a.is_enabled ? t("settings.adapter.enabled") : t("settings.adapter.disabled")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <Button variant="outline" size="sm" onClick={() => toggle(a.kind, a.provider, !a.is_enabled)}>
                    {a.is_enabled ? t("settings.actions.disable") : t("settings.actions.enable")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
