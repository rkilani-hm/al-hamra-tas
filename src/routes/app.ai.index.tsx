// Route: /app/ai — Module M2.1 AI Recruitment Copilot (dormant).
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { aiGenerateJd, aiStatus, type JdOutput } from "@/features/ai/api";

export const Route = createFileRoute("/app/ai/")({
  head: () => ({
    meta: [
      { title: "AI Copilot — Al Hamra TAS" },
      { name: "description", content: "AI recruitment copilot." },
    ],
  }),
  component: AiPage,
});

function AiPage() {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canUse = capabilities.includes("ai.use");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [output, setOutput] = useState<JdOutput | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusQ = useQuery({ queryKey: ["ai", "status"], queryFn: aiStatus, enabled: canUse });
  const enabled = statusQ.data?.is_enabled ?? false;

  const generate = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await aiGenerateJd(title.trim(), notes.trim() || null);
      setOutput(r.output);
      setMsg(r.message);
      if (r.dormant) toast.info(t("ai.dormantToast"));
    } catch {
      toast.error(t("ai.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!canUse) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("ai.noPermission")}</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("ai.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("ai.page.subtitle")}</p>
          </div>
        </div>
        <Badge variant={enabled ? "default" : "outline"}>{enabled ? t("ai.enabled") : t("ai.dormant")}</Badge>
      </header>

      {!enabled && (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("ai.dormantNote")}</p>
      )}

      <section className="space-y-3 rounded-md border p-4">
        <h3 className="font-medium text-foreground">{t("ai.jd.title")}</h3>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("ai.jd.roleTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("ai.jd.notes")}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Button onClick={generate} disabled={busy || !title.trim()}>{t("ai.jd.generate")}</Button>
          </div>
        </div>
        {msg && (
          <div className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            {output?.text ?? msg}
          </div>
        )}
      </section>
    </div>
  );
}
