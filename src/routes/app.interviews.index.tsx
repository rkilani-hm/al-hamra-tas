// Route: /app/interviews — Module M1.7 interview list + my interviews.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { AdapterStatus } from "@/features/interviews/components/AdapterStatus";
import { MyInterviews } from "@/features/interviews/components/MyInterviews";
import { listInterviews, safe } from "@/features/interviews/api";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/interviews/")({
  head: () => ({
    meta: [
      { title: "Interviews — Al Hamra TAS" },
      { name: "description", content: "Schedule and manage candidate interviews." },
    ],
  }),
  component: InterviewsPage,
});

function InterviewsPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentUserId } = useAuth();

  const allQ = useQuery({ queryKey: ["interviews", "all"], queryFn: safe(() => listInterviews({ limit: 50 })) });
  const all = allQ.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("interviews.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("interviews.page.subtitle")}</p>
          </div>
        </div>
        <AdapterStatus />
      </header>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">{t("interviews.mine.title")}</h2>
        <MyInterviews currentUserId={currentUserId} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-foreground">{t("interviews.list.all")}</h2>
        {allQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("interviews.common.loading")}</p>
        ) : all.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("interviews.panel.none")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {all.map((iv) => (
              <li key={iv.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex flex-col">
                  <Link to="/app/interviews/$id" params={{ id: iv.id }} className="text-sm font-medium text-primary hover:underline">
                    {iv.reference ?? iv.id}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {(language === "ar" ? iv.candidate_name_ar : iv.candidate_name_en) ?? iv.application_ref ?? "—"}
                    {" · "}
                    {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : t("interviews.panel.unscheduled")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{t(`interviews.mode.${iv.mode}`)}</Badge>
                  <Badge variant="outline">{t(`interviews.status.${iv.status}`)}</Badge>
                  {iv.outcome && (
                    <Badge variant={iv.outcome === "reject" ? "destructive" : "default"}>
                      {t(`interviews.outcome.${iv.outcome}`)}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
