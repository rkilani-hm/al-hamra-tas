import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, KanbanSquare, ClipboardCheck, CalendarClock, FileSignature,
  Inbox, Sparkles, LayoutDashboard, ArrowRight, FileCheck2, AlertTriangle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { recruitmentKpis } from "@/features/reports/api";
import { myPendingTasks, safe as safeWf } from "@/features/workflow/api";
import { listRequisitions, safe as safeReq } from "@/features/requisition/api";
import { listAssessments, safe as safeAsm } from "@/features/assessment/api";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Al Hamra TAS" },
      { name: "description", content: "Recruitment pipeline at a glance." },
    ],
  }),
  component: AppHome,
});

type QuickAction = { cap: string; url: string; labelKey: string; icon: typeof ClipboardList };

const QUICK_ACTIONS: QuickAction[] = [
  { cap: "requisition.write", url: "/app/requisitions/new", labelKey: "dashboard.actions.newRequisition", icon: ClipboardList },
  { cap: "application.write", url: "/app/applications/board", labelKey: "dashboard.actions.applicationsBoard", icon: KanbanSquare },
  { cap: "screening.write", url: "/app/screening", labelKey: "dashboard.actions.screening", icon: ClipboardCheck },
  { cap: "interview.score", url: "/app/interviews", labelKey: "dashboard.actions.interviews", icon: CalendarClock },
  { cap: "offer.write", url: "/app/offers/new", labelKey: "dashboard.actions.newOffer", icon: FileSignature },
  { cap: "approval.act", url: "/app/workflow/inbox", labelKey: "dashboard.actions.approvals", icon: Inbox },
  { cap: "ai.use", url: "/app/ai", labelKey: "dashboard.actions.aiCopilot", icon: Sparkles },
];

function AppHome() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tasUser, capabilities } = useAuth();
  const canView = capabilities.includes("report.view");

  const q = useQuery({ queryKey: ["reports", "kpis"], queryFn: recruitmentKpis, enabled: canView });
  const k = q.data ?? null;
  const stageMax = Math.max(1, ...(k?.by_stage ?? []).map((s) => s.count));

  const name = language === "ar" ? tasUser?.display_name_ar : tasUser?.display_name_en;
  const greeting = name ? t("dashboard.greeting", { name }) : t("dashboard.greetingNoName");

  const actions = QUICK_ACTIONS.filter((a) => capabilities.includes(a.cap));
  const showForYou =
    capabilities.includes("approval.act") ||
    capabilities.includes("requisition.write") ||
    capabilities.includes("assessment.write");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{greeting}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>
      </header>

      {/* For you — role-tailored, actionable widgets. Each is capability-gated. */}
      {showForYou && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.forYouTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.includes("approval.act") && <ApprovalsWidget />}
            {capabilities.includes("requisition.write") && <RequisitionsWidget />}
            {capabilities.includes("assessment.write") && <AssessmentsWidget />}
          </div>
        </section>
      )}

      {/* Pipeline snapshot — reuses the M2.4 recruitment_kpis RPC (report.view gated). */}
      {canView ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.kpisTitle")}</h2>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("reports.loading")}</p>
          ) : !k ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("reports.empty")}</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label={t("reports.kpi.openRequisitions")} value={k.open_requisitions} to="/app/requisitions" />
                <KpiCard label={t("reports.kpi.activeApplications")} value={k.active_applications} to="/app/applications" />
                <KpiCard label={t("reports.kpi.offersPending")} value={k.offers_pending} to="/app/offers" />
                <KpiCard label={t("reports.kpi.hires")} value={k.hires} to="/app/reports" />
              </div>

              <section className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">{t("reports.funnel.title")}</h3>
                  <Link to="/app/reports" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    {t("dashboard.viewReports")} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                  </Link>
                </div>
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
            </>
          )}
        </section>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("dashboard.kpisLocked")}</p>
      )}

      {/* Quick actions — each tile gated by the capability its destination requires. */}
      {actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">{t("dashboard.quickActionsTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => (
              <Link
                key={a.url}
                to={a.url}
                className="group flex items-center gap-3 rounded-md border p-4 transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <a.icon className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm font-medium text-foreground">{t(a.labelKey)}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Widget shell -----------------------------------------------------------

function WidgetShell({
  icon: Icon, title, count, to, viewAllLabel, children,
}: {
  icon: typeof Inbox; title: string; count: number; to: string; viewAllLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="ms-auto text-2xl font-semibold text-foreground" dir="ltr">{count}</span>
      </div>
      <div className="min-h-[1.25rem] flex-1 text-sm">{children}</div>
      <Link to={to} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
        {viewAllLabel} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
      </Link>
    </div>
  );
}

// --- Approvals (approval.act) ----------------------------------------------

function ApprovalsWidget() {
  const { t } = useTranslation();
  const { currentUserId } = useAuth();
  const q = useQuery({
    queryKey: ["dashboard", "approvals", currentUserId],
    queryFn: safeWf(() => myPendingTasks(currentUserId as string)),
    enabled: !!currentUserId,
  });
  const tasks = q.data ?? [];
  const now = new Date();
  const overdue = tasks.filter((x) => x.due_at && new Date(x.due_at) < now).length;

  return (
    <WidgetShell
      icon={Inbox}
      title={t("dashboard.widgets.approvalsTitle")}
      count={tasks.length}
      to="/app/workflow/inbox"
      viewAllLabel={t("dashboard.widgets.viewAll")}
    >
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">{t("dashboard.widgets.approvalsEmpty")}</p>
      ) : (
        <div className="space-y-1">
          {overdue > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {t("dashboard.widgets.overdue", { count: overdue })}
            </Badge>
          )}
          <ul className="space-y-0.5 text-muted-foreground">
            {tasks.slice(0, 3).map((x) => (
              <li key={x.task_id} className="truncate">
                {t(`workflow.requestType.${x.request_type}`, x.request_type)}{x.request_ref ? ` · ${x.request_ref}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </WidgetShell>
  );
}

// --- My requisitions (requisition.write) -----------------------------------

function RequisitionsWidget() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const q = useQuery({
    queryKey: ["dashboard", "myRequisitions"],
    queryFn: safeReq(() => listRequisitions({ mine: true, limit: 5 })),
  });
  const rows = q.data ?? [];

  return (
    <WidgetShell
      icon={ClipboardList}
      title={t("dashboard.widgets.requisitionsTitle")}
      count={rows.length}
      to="/app/requisitions"
      viewAllLabel={t("dashboard.widgets.viewAll")}
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{t("dashboard.widgets.requisitionsEmpty")}</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 3).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground">
                {(language === "ar" ? r.title_ar : r.title_en) || r.reference || r.id}
              </span>
              <Badge variant="outline" className="shrink-0">{t(`requisition.status.${r.status}`, r.status)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// --- Assessments to complete (assessment.write) ----------------------------

function AssessmentsWidget() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["dashboard", "draftAssessments"],
    queryFn: safeAsm(() => listAssessments()),
  });
  const drafts = (q.data ?? []).filter((a) => a.status === "draft");

  return (
    <WidgetShell
      icon={FileCheck2}
      title={t("dashboard.widgets.assessmentsTitle")}
      count={drafts.length}
      to="/app/assessments"
      viewAllLabel={t("dashboard.widgets.viewAll")}
    >
      {drafts.length === 0 ? (
        <p className="text-muted-foreground">{t("dashboard.widgets.assessmentsEmpty")}</p>
      ) : (
        <ul className="space-y-0.5 text-muted-foreground">
          {drafts.slice(0, 3).map((a) => (
            <li key={a.id} className="truncate">
              {a.title || t(`assessment.type.${a.assessment_type}`)}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function KpiCard({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-md border p-4 transition-colors hover:border-primary/50 hover:bg-accent">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground" dir="ltr">{value}</p>
    </Link>
  );
}
