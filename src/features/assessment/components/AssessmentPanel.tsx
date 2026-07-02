// Module M1.8 — AssessmentPanel: embedded in ApplicationDetail. Lists assessments
// + a "New assessment" CTA (gated); expands the AssessmentForm to score/submit.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/AuthProvider";
import { createAssessment, listAssessments, safe } from "../api";
import type { AssessmentType } from "../types";
import { AssessmentForm } from "./AssessmentForm";

const TYPES: AssessmentType[] = ["technical", "psychometric", "case_study", "other"];

interface AssessmentPanelProps {
  applicationId: string;
}

export function AssessmentPanel({ applicationId }: AssessmentPanelProps) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("assessment.write");
  const qc = useQueryClient();
  const [type, setType] = useState<AssessmentType>("technical");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["assessment", "byApplication", applicationId],
    queryFn: safe(() => listAssessments(applicationId)),
  });
  const rows = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["assessment", "byApplication", applicationId] });

  const onCreate = async () => {
    setBusy(true);
    try {
      const id = await createAssessment(applicationId, type, null);
      setOpenId(id);
      toast.success(t("assessment.toasts.created"));
      await refresh();
    } catch {
      toast.error(t("assessment.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex flex-wrap items-end gap-2">
          <Select value={type} onValueChange={(v) => setType(v as AssessmentType)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t(`assessment.type.${ty}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={onCreate} disabled={busy}>{t("assessment.actions.new")}</Button>
        </div>
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("assessment.common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("assessment.panel.none")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((r) => (
            <li key={r.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="flex items-center gap-2 text-start" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span className="text-sm font-medium text-foreground">{t(`assessment.type.${r.assessment_type}`)}</span>
                  {r.overall_score != null && <span className="text-xs text-muted-foreground">{r.overall_score}</span>}
                </button>
                <div className="flex items-center gap-2">
                  {r.recommendation && <Badge variant="outline">{t(`assessment.recommendation.${r.recommendation}`)}</Badge>}
                  <Badge variant={r.status === "submitted" ? "default" : "secondary"}>{t(`assessment.status.${r.status}`)}</Badge>
                </div>
              </div>
              {openId === r.id && (
                <div className="mt-3">
                  <AssessmentForm assessmentId={r.id} onSaved={refresh} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
