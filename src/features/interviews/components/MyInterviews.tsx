// Module M1.7 — MyInterviews: interviews where the caller is a panelist. Gated
// on currentUserId — renders a sign-in stub when null (Entra wired last).
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { listInterviews, safe } from "../api";

interface MyInterviewsProps {
  currentUserId?: string | null;
}

export function MyInterviews({ currentUserId = null }: MyInterviewsProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const q = useQuery({
    queryKey: ["interviews", "mine"],
    queryFn: safe(() => listInterviews({ mine: true, limit: 50 })),
    enabled: !!currentUserId,
  });
  const interviews = q.data ?? [];

  if (!currentUserId) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("interviews.mine.signIn")}
      </p>
    );
  }

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("interviews.common.loading")}</p>;
  if (interviews.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("interviews.mine.none")}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {interviews.map((iv) => (
        <li key={iv.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{iv.reference ?? iv.id}</span>
            <span className="text-xs text-muted-foreground">
              {(language === "ar" ? iv.candidate_name_ar : iv.candidate_name_en) ?? iv.application_ref ?? "—"}
              {" · "}
              {iv.scheduled_at ? new Date(iv.scheduled_at).toLocaleString() : t("interviews.panel.unscheduled")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`interviews.status.${iv.status}`)}</Badge>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/interviews/$id" params={{ id: iv.id }}>{t("interviews.actions.submitScorecard")}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
