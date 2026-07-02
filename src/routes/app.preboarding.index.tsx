// Route: /app/preboarding — Module M1.10 pre-boarding worklist.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { listPreboarding, safe } from "@/features/preboarding/api";

export const Route = createFileRoute("/app/preboarding/")({
  head: () => ({
    meta: [
      { title: "Pre-Boarding — Al Hamra TAS" },
      { name: "description", content: "Collect new-hire documents and track pre-boarding readiness." },
    ],
  }),
  component: PreBoardingPage,
});

function PreBoardingPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const q = useQuery({ queryKey: ["preboarding", "all"], queryFn: safe(() => listPreboarding()) });
  const rows = q.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("preboarding.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("preboarding.page.subtitle")}</p>
        </div>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("preboarding.common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("preboarding.page.empty")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <Link to="/app/preboarding/$id" params={{ id: r.id }} className="text-sm font-medium text-primary hover:underline">
                  {(language === "ar" ? r.candidate_name_ar : r.candidate_name_en) || r.candidate_name_en || "—"}
                </Link>
                <span className="text-xs text-muted-foreground" dir="ltr">{r.reference ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{r.required_done}/{r.required_total}</span>
                <Badge variant={r.status === "completed" ? "default" : "outline"}>{t(`preboarding.status.${r.status}`)}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
