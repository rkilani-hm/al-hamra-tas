// Module M1.8 — AssessmentForm: score weighted items + submit with recommendation.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { assessmentDetail, saveAssessmentItems, submitAssessment } from "../api";
import type { AssessmentRecommendation } from "../types";

const RECS: AssessmentRecommendation[] = ["proceed", "hold", "reject"];

interface AssessmentFormProps {
  assessmentId: string;
  onSaved: () => void;
}

interface Row { score: string; note: string }

export function AssessmentForm({ assessmentId, onSaved }: AssessmentFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("assessment.write");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [recommendation, setRecommendation] = useState<AssessmentRecommendation | "">("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const q = useQuery({ queryKey: ["assessment", "detail", assessmentId], queryFn: () => assessmentDetail(assessmentId) });
  const items = q.data?.items ?? [];
  const submitted = q.data?.assessment?.status === "submitted";

  if (!seeded && items.length > 0) {
    const init: Record<string, Row> = {};
    for (const i of items) init[i.id] = { score: i.score != null ? String(i.score) : "", note: i.note ?? "" };
    setRows(init);
    setSeeded(true);
    if (q.data?.assessment?.recommendation) setRecommendation(q.data.assessment.recommendation);
    if (q.data?.assessment?.notes) setNotes(q.data.assessment.notes);
  }

  const overall = useMemo(() => {
    let ws = 0, w = 0;
    for (const i of items) {
      const s = parseFloat(rows[i.id]?.score ?? "");
      if (!Number.isNaN(s)) { ws += s * i.weight; w += i.weight; }
    }
    return w > 0 ? Math.round((ws / w) * 100) / 100 : null;
  }, [items, rows]);

  const payload = () => items.map((i) => ({
    id: i.id,
    score: rows[i.id]?.score ? Number(rows[i.id].score) : null,
    note: rows[i.id]?.note || null,
  }));

  const onSave = async () => {
    setBusy(true);
    try {
      await saveAssessmentItems(assessmentId, payload());
      toast.success(t("assessment.toasts.saved"));
      onSaved();
    } catch {
      toast.error(t("assessment.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!recommendation) return;
    setBusy(true);
    try {
      await saveAssessmentItems(assessmentId, payload());
      await submitAssessment(assessmentId, recommendation, notes || null);
      toast.success(t("assessment.toasts.submitted"));
      onSaved();
    } catch {
      toast.error(t("assessment.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("assessment.common.loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-md border p-2">
            <span className="min-w-40 flex-1 text-sm text-foreground">
              {language === "ar" ? i.label_ar : i.label_en}
              <span className="ms-1 text-xs text-muted-foreground">×{i.weight}</span>
            </span>
            <Input
              type="number" min={0} max={i.max_score} className="h-8 w-20"
              value={rows[i.id]?.score ?? ""} disabled={submitted || !canWrite}
              onChange={(e) => setRows((p) => ({ ...p, [i.id]: { ...p[i.id], score: e.target.value } }))}
            />
            <span className="text-xs text-muted-foreground">/ {i.max_score}</span>
            <Input
              className="h-8 flex-1" placeholder={t("assessment.form.note")}
              value={rows[i.id]?.note ?? ""} disabled={submitted || !canWrite}
              onChange={(e) => setRows((p) => ({ ...p, [i.id]: { ...p[i.id], note: e.target.value } }))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("assessment.form.overall")}:</span>
        <span className="font-medium text-foreground">{overall ?? "—"}</span>
      </div>

      {!submitted && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">{t("assessment.form.recommendation")}</Label>
            <Select value={recommendation || undefined} onValueChange={(v) => setRecommendation(v as AssessmentRecommendation)} disabled={!canWrite}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder={t("assessment.form.recommendation")} /></SelectTrigger>
              <SelectContent>
                {RECS.map((r) => <SelectItem key={r} value={r}>{t(`assessment.recommendation.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs">{t("assessment.form.notes")}</Label>
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWrite} />
          </div>
        </div>
      )}

      {!submitted && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSave} disabled={busy || !canWrite}>{t("assessment.actions.save")}</Button>
          <Button onClick={onSubmit} disabled={busy || !recommendation || !canWrite}>{t("assessment.actions.submit")}</Button>
        </div>
      )}
    </div>
  );
}
