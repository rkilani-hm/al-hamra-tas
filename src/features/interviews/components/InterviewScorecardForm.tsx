// Module M1.7 — InterviewScorecardForm: the caller's own panelist scorecard.
// Reuses the M1.6 scoring shape (criterion inputs up to max_score, weighted
// overall, recommendation proceed/reject/hold, notes EN).
import { useMemo, useState } from "react";
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
import { submitInterviewScore } from "../api";
import type {
  InterviewCriterion,
  InterviewRecommendation,
  InterviewScore,
  InterviewScoreInput,
} from "../types";

interface InterviewScorecardFormProps {
  interviewId: string;
  criteria: InterviewCriterion[];
  existing?: InterviewScore | null;
  onSaved: () => void;
}

interface ScoreState {
  score: string;
  note: string;
}

export function InterviewScorecardForm({ criteria, interviewId, existing, onSaved }: InterviewScorecardFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [scores, setScores] = useState<Record<string, ScoreState>>(() => {
    const init: Record<string, ScoreState> = {};
    for (const c of criteria) {
      const d = existing?.details.find((x) => x.criterion_id === c.criterion_id);
      init[c.criterion_id] = {
        score: d?.score === null || d?.score === undefined ? "" : String(d.score),
        note: d?.note ?? "",
      };
    }
    return init;
  });
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | "">(
    existing?.recommendation ?? "",
  );
  const [notes, setNotes] = useState(existing?.notes_en ?? "");
  const [busy, setBusy] = useState(false);

  const critName = (c: InterviewCriterion) => (language === "ar" ? c.name_ar : c.name_en);

  const overall = useMemo(() => {
    let weighted = 0;
    let weightSum = 0;
    for (const c of criteria) {
      const raw = scores[c.criterion_id]?.score ?? "";
      if (raw === "") continue;
      const v = Number(raw);
      if (Number.isNaN(v)) continue;
      weighted += v * c.weight;
      weightSum += c.weight;
    }
    if (weightSum <= 0) return null;
    return Math.round((weighted / weightSum) * 100) / 100;
  }, [criteria, scores]);

  const setScore = (id: string, score: string) =>
    setScores((s) => ({ ...s, [id]: { ...s[id], score } }));
  const setNote = (id: string, note: string) =>
    setScores((s) => ({ ...s, [id]: { ...s[id], note } }));

  const onSubmit = async () => {
    if (!recommendation) {
      toast.error(t("interviews.toasts.error"));
      return;
    }
    const payload: InterviewScoreInput[] = criteria.map((c) => {
      const raw = scores[c.criterion_id]?.score ?? "";
      return {
        criterion_id: c.criterion_id,
        score: raw === "" ? null : Number(raw),
        note: scores[c.criterion_id]?.note || null,
      };
    });
    setBusy(true);
    try {
      await submitInterviewScore(interviewId, payload, recommendation, notes || null);
      toast.success(t("interviews.toasts.scoreSaved"));
      onSaved();
    } catch {
      toast.error(t("interviews.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  if (criteria.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("interviews.scorecard.noCriteria")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="py-2 pe-3 text-start font-medium">{t("interviews.scorecard.criterion")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("interviews.scorecard.weight")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("interviews.scorecard.max")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("interviews.scorecard.score")}</th>
              <th className="py-2 ps-3 text-start font-medium">{t("interviews.scorecard.note")}</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.criterion_id} className="border-b last:border-0">
                <td className="py-2 pe-3 font-medium text-foreground">{critName(c)}</td>
                <td className="py-2 px-3 text-muted-foreground" dir="ltr">{c.weight}</td>
                <td className="py-2 px-3 text-muted-foreground" dir="ltr">{c.max_score}</td>
                <td className="py-2 px-3">
                  <Input
                    type="number"
                    min={0}
                    max={c.max_score}
                    step={1}
                    dir="ltr"
                    className="h-8 w-20"
                    value={scores[c.criterion_id]?.score ?? ""}
                    onChange={(e) => setScore(c.criterion_id, e.target.value)}
                  />
                </td>
                <td className="py-2 ps-3">
                  <Input
                    className="h-8"
                    value={scores[c.criterion_id]?.note ?? ""}
                    onChange={(e) => setNote(c.criterion_id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("interviews.scorecard.overall")}</span>
          <span className="text-lg font-semibold text-foreground" dir="ltr">
            {overall === null ? "—" : overall}
          </span>
        </div>
        <div className="flex w-48 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.scorecard.recommendation")}</Label>
          <Select value={recommendation || undefined} onValueChange={(v) => setRecommendation(v as InterviewRecommendation)}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("interviews.scorecard.recommendation")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="proceed">{t("interviews.outcome.proceed")}</SelectItem>
              <SelectItem value="reject">{t("interviews.outcome.reject")}</SelectItem>
              <SelectItem value="hold">{t("interviews.outcome.hold")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("interviews.scorecard.notes")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <Button onClick={onSubmit} disabled={busy || !recommendation}>
        {busy ? t("interviews.actions.saving") : t("interviews.actions.submitScorecard")}
      </Button>
    </div>
  );
}
