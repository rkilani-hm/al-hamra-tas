// Route: /app/onboarding — Module M1.11 onboarding worklist.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { listOnboarding, safe } from "@/features/onboarding/api";

export const Route = createFileRoute("/app/onboarding/")({
  head: () => ({
    meta: [
      { title: "Onboarding — Al Hamra TAS" },
      { name: "description", content: "New-hire onboarding and MenaME HRMS handoff." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const q = useQuery({ queryKey: ["onboarding", "all"], queryFn: safe(() => listOnboarding()) });
  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <UserCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("onboarding.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("onboarding.page.subtitle")}</p>
        </div>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("onboarding.common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("onboarding.page.empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/onboarding/$id" params={{ id: r.id }} className="text-sm font-medium text-primary hover:underline">
                  {(language === "ar" ? r.candidate_name_ar : r.candidate_name_en) || r.candidate_name_en || "—"}
                </Link>
                <span className="text-xs text-muted-foreground" dir="ltr">{r.reference ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t(`onboarding.handoff.${r.handoff_status}`)}</Badge>
                <Badge variant={r.status === "completed" ? "default" : "outline"}>{t(`onboarding.status.${r.status}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
