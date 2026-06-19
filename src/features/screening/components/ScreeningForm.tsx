// Module M1.6 — ScreeningForm: edit a draft screening. Score each criterion
// (0..max, weight shown), live weighted overall, recommendation + notes,
// Save draft / Submit (submit drives the M1.5 stage action server-side).
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
import { saveScreeningScores, submitScreening } from "../api";
import type {
  ScreeningRecommendation,
  ScreeningRecord,
  ScreeningScoreInput,
} from "../types";

interface ScreeningFormProps {
  applicationId: string;
  screening: ScreeningRecord;
  onSaved: () => void;
}

interface ScoreState {
  score: string; // raw input; "" = unscored
  note: string;
}

export function ScreeningForm({ screening, onSaved }: ScreeningFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const criteria = screening.criteria;
  const [scores, setScores] = useState<Record<string, ScoreState>>(() => {
    const init: Record<string, ScoreState> = {};
    for (const c of criteria) {
      init[c.criterion_id] = {
        score: c.score === null || c.score === undefined ? "" : String(c.score),
        note: c.note ?? "",
      };
    }
    return init;
  });
  const [recommendation, setRecommendation] = useState<ScreeningRecommendation | "">(
    screening.recommendation ?? "",
  );
  const [notes, setNotes] = useState(screening.notes_en ?? "");
  const [busy, setBusy] = useState(false);

  const critName = (c: { name_en: string; name_ar: string }) =>
    language === "ar" ? c.name_ar : c.name_en;

  // Live weighted overall (mirrors save_screening_scores server math).
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

  const toPayload = (): ScreeningScoreInput[] =>
    criteria.map((c) => {
      const raw = scores[c.criterion_id]?.score ?? "";
      return {
        criterion_id: c.criterion_id,
        score: raw === "" ? null : Number(raw),
        note: scores[c.criterion_id]?.note || null,
      };
    });

  const onSaveDraft = async () => {
    setBusy(true);
    try {
      await saveScreeningScores(screening.id, toPayload());
      toast.success(t("screening.toasts.saved"));
      onSaved();
    } catch {
      toast.error(t("screening.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (!recommendation) {
      toast.error(t("screening.toasts.error"));
      return;
    }
    setBusy(true);
    try {
      await saveScreeningScores(screening.id, toPayload());
      const res = await submitScreening(screening.id, recommendation, notes || null);
      if (!res.moved && res.message === "no_shortlist_stage") {
        toast.warning(t("screening.toasts.noStage"));
      } else {
        toast.success(t("screening.toasts.submitted"));
      }
      onSaved();
    } catch {
      toast.error(t("screening.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-xs text-muted-foreground">
              <th className="py-2 pe-3 text-start font-medium">{t("screening.form.criterion")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("screening.form.weight")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("screening.form.max")}</th>
              <th className="py-2 px-3 text-start font-medium">{t("screening.form.score")}</th>
              <th className="py-2 ps-3 text-start font-medium">{t("screening.form.note")}</th>
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
          <span className="text-xs text-muted-foreground">{t("screening.form.overall")}</span>
          <span className="text-lg font-semibold text-foreground" dir="ltr">
            {overall === null ? "—" : overall}
          </span>
        </div>
        <div className="flex w-48 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("screening.form.recommendation")}</Label>
          <Select value={recommendation || undefined} onValueChange={(v) => setRecommendation(v as ScreeningRecommendation)}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("screening.form.recommendation")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shortlist">{t("screening.recommendation.shortlist")}</SelectItem>
              <SelectItem value="reject">{t("screening.recommendation.reject")}</SelectItem>
              <SelectItem value="hold">{t("screening.recommendation.hold")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("screening.form.notes")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onSaveDraft} disabled={busy}>
          {busy ? t("screening.form.saving") : t("screening.form.saveDraft")}
        </Button>
        <Button onClick={onSubmit} disabled={busy || !recommendation}>
          {t("screening.form.submit")}
        </Button>
      </div>
    </div>
  );
}
