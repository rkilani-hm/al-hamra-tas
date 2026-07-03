// Module M2.5 — MeetingNotesPanel: embedded in InterviewDetail. Authors raw
// meeting notes (gate interview.score) and summarizes them with the Lovable AI
// copilot (gate ai.use; dormant until the AI adapter is enabled).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLanguage } from "@/hooks/use-language";
import { listInterviewNotes, saveInterviewNote, summarizeMeeting, safe } from "../notesApi";

export function MeetingNotesPanel({ interviewId }: { interviewId: string }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("interview.score");
  const canAi = capabilities.includes("ai.use");
  const qc = useQueryClient();

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["interviews", "notes", interviewId],
    queryFn: safe(() => listInterviewNotes(interviewId)),
  });
  const notes = q.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["interviews", "notes", interviewId] });

  const onSave = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await saveInterviewNote(interviewId, text.trim());
      setText("");
      toast.success(t("interviews.notes.saved"));
      refresh();
    } catch {
      toast.error(t("interviews.notes.error"));
    } finally {
      setBusy(false);
    }
  };

  const onSummarize = async (id: string) => {
    setSummarizingId(id);
    try {
      const r = await summarizeMeeting(id);
      if (r.dormant) toast.info(t("interviews.notes.aiDormant"));
      else toast.success(t("interviews.notes.summarized"));
      refresh();
    } catch {
      toast.error(t("interviews.notes.error"));
    } finally {
      setSummarizingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-foreground">{t("interviews.notes.title")}</h3>
      </div>

      {canWrite && (
        <div className="space-y-2">
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("interviews.notes.placeholder")}
          />
          <Button onClick={onSave} disabled={busy || !text.trim()}>{t("interviews.notes.save")}</Button>
        </div>
      )}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("interviews.common.loading")}</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("interviews.notes.none")}</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const summary = language === "ar" ? (n.summary_ar || n.summary_en) : (n.summary_en || n.summary_ar);
            const hasSummary = Boolean(n.summary_en || n.summary_ar);
            return (
              <li key={n.id} className="space-y-2 rounded-md border p-3">
                {n.raw_text && <p className="whitespace-pre-wrap text-sm text-foreground">{n.raw_text}</p>}

                {hasSummary ? (
                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">{t("interviews.notes.aiSummary")}</span>
                      {n.recommendation && <Badge variant="outline">{t(`interviews.outcome.${n.recommendation}`)}</Badge>}
                    </div>
                    {summary && <p className="whitespace-pre-wrap text-sm text-foreground">{summary}</p>}
                    {n.key_points?.length > 0 && (
                      <ul className="list-disc space-y-0.5 ps-5 text-sm text-muted-foreground">
                        {n.key_points.map((k, i) => <li key={i}>{k}</li>)}
                      </ul>
                    )}
                  </div>
                ) : canAi ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => onSummarize(n.id)}
                    disabled={summarizingId === n.id}
                  >
                    <Sparkles className="h-4 w-4" />
                    {summarizingId === n.id ? t("interviews.notes.summarizing") : t("interviews.notes.summarize")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
