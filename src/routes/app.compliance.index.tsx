// Route: /app/compliance — Module M3.3 Audit & Compliance Reporting.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/features/auth/AuthProvider";
import { auditReport, auditStats, safe } from "@/features/compliance/api";

export const Route = createFileRoute("/app/compliance/")({
  head: () => ({
    meta: [
      { title: "Compliance Reporting — Al Hamra TAS" },
      { name: "description", content: "System-wide audit and compliance reporting." },
    ],
  }),
  component: CompliancePage,
});

const ALL = "__all__";

function CompliancePage() {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canView = capabilities.includes("audit.view");
  const [module, setModule] = useState<string>(ALL);

  const statsQ = useQuery({ queryKey: ["compliance", "stats"], queryFn: auditStats, enabled: canView });
  const reportQ = useQuery({
    queryKey: ["compliance", "report", module],
    queryFn: safe(() => auditReport(module === ALL ? null : module)),
    enabled: canView,
  });
  const stats = statsQ.data ?? null;
  const rows = reportQ.data ?? [];

  const modules = (stats?.by_module ?? []).map((m) => m.module_code).filter((m) => m !== "—");

  if (!canView) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("compliance.noPermission")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("compliance.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("compliance.page.subtitle")}</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t("compliance.kpi.total")} value={stats?.total ?? 0} />
        <Kpi label={t("compliance.kpi.last24h")} value={stats?.last_24h ?? 0} />
        <Kpi label={t("compliance.kpi.modules")} value={(stats?.by_module ?? []).length} />
        <Kpi label={t("compliance.kpi.eventTypes")} value={(stats?.by_event ?? []).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title={t("compliance.byModule")} rows={(stats?.by_module ?? []).map((m) => ({ label: m.module_code, count: m.count }))} />
        <Breakdown title={t("compliance.byEvent")} rows={(stats?.by_event ?? []).map((e) => ({ label: e.event_type, count: e.count }))} />
      </div>

      <section className="space-y-2 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-foreground">{t("compliance.recent")}</h3>
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("compliance.allModules")}</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("compliance.table.time")}</TableHead>
              <TableHead className="text-start">{t("compliance.table.actor")}</TableHead>
              <TableHead className="text-start">{t("compliance.table.module")}</TableHead>
              <TableHead className="text-start">{t("compliance.table.event")}</TableHead>
              <TableHead className="text-start">{t("compliance.table.entity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportQ.isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t("compliance.empty")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground" dir="ltr">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.actor_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.module_code ?? "—"}</Badge></TableCell>
                  <TableCell>{r.event_type ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.entity_type ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground" dir="ltr">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <section className="space-y-2 rounded-md border p-4">
      <h3 className="font-medium text-foreground">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium text-foreground" dir="ltr">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
