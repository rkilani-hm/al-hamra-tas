// Route: /app/reports — Module M2.4 native recruitment KPI dashboard.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileBarChart } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { recruitmentKpis } from "@/features/reports/api";

export const Route = createFileRoute("/app/reports/")({
  head: () => ({
    meta: [
      { title: "Reports — Al Hamra TAS" },
      { name: "description", content: "Recruitment KPIs and analytics." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canView = capabilities.includes("report.view");

  const q = useQuery({ queryKey: ["reports", "kpis"], queryFn: recruitmentKpis, enabled: canView });
  const k = q.data ?? null;

  const stageMax = Math.max(1, ...(k?.by_stage ?? []).map((s) => s.count));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <FileBarChart className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("reports.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("reports.page.subtitle")}</p>
        </div>
      </header>

      {!canView ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("reports.noPermission")}</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("reports.loading")}</p>
      ) : !k ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("reports.empty")}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t("reports.kpi.openRequisitions")} value={k.open_requisitions} />
            <KpiCard label={t("reports.kpi.activeApplications")} value={k.active_applications} />
            <KpiCard label={t("reports.kpi.offersPending")} value={k.offers_pending} />
            <KpiCard label={t("reports.kpi.hires")} value={k.hires} />
          </div>

          <section className="space-y-3 rounded-md border p-4">
            <h3 className="font-medium text-foreground">{t("reports.funnel.title")}</h3>
            <div className="space-y-2">
              {k.by_stage.map((s) => (
                <div key={s.stage_id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">{language === "ar" ? s.name_ar : s.name_en}</span>
                  <div className="h-4 flex-1 rounded bg-muted/40">
                    <div className="h-4 rounded bg-primary" style={{ width: `${(s.count / stageMax) * 100}%` }} />
                  </div>
                  <span className="w-8 text-end text-sm font-medium text-foreground" dir="ltr">{s.count}</span>
                </div>
              ))}
              {k.by_stage.length === 0 && <p className="text-sm text-muted-foreground">{t("reports.empty")}</p>}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard title={t("reports.offersByStatus")} rows={k.offers_by_status.map((o) => ({ label: o.status, count: o.count }))} />
            <BreakdownCard title={t("reports.applicationsBySource")} rows={k.applications_by_source.map((s) => ({ label: s.source, count: s.count }))} />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground" dir="ltr">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <section className="space-y-2 rounded-md border p-4">
      <h3 className="font-medium text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
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
