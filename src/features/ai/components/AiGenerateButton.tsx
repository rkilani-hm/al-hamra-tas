// Module M2.1 — reusable "generate with AI, then insert into this section" button.
// Drop it next to any editable section: pass a `generate` fn (task + context),
// an `onApply` callback that writes the output into your fields, and a preview
// renderer. Only shown to users with the ai.use capability; the dialog handles
// the dormant state (adapter off) gracefully.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthProvider";

export interface AiResult<T> {
  dormant: boolean;
  output: T | null;
  message: string;
}

interface AiGenerateButtonProps<T> {
  /** Called with the free-text notes from the dialog; wires the task + context. */
  generate: (notes: string) => Promise<AiResult<T>>;
  /** Writes the generated output into the target fields. */
  onApply: (output: T) => void;
  /** Renders a preview of the generated output before the user applies it. */
  renderPreview: (output: T) => ReactNode;
  label?: string;
  title?: string;
  applyLabel?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function AiGenerateButton<T>({
  generate, onApply, renderPreview, label, title, applyLabel, disabled, size = "sm",
}: AiGenerateButtonProps<T>) {
  const { t } = useTranslation();
  const { capabilities } = useAuth();
  const canUse = capabilities.includes("ai.use");
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiResult<T> | null>(null);

  if (!canUse) return null;

  const close = () => { setOpen(false); setNotes(""); setResult(null); };

  const run = async () => {
    setBusy(true);
    try {
      const r = await generate(notes);
      setResult(r);
      if (r.dormant) toast.info(r.message);
    } catch {
      toast.error(t("ai.assist.error"));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (result?.output && !result.dormant) {
      onApply(result.output);
      toast.success(t("ai.assist.applied"));
      close();
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size={size} className="gap-1" onClick={() => setOpen(true)} disabled={disabled}>
        <Sparkles className="h-4 w-4" /> {label ?? t("ai.assist.button")}
      </Button>
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{title ?? t("ai.assist.title")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">{t("ai.assist.notesLabel")}</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ai.assist.notesHint")} />
            </div>
            <Button type="button" onClick={run} disabled={busy}>
              {busy ? t("ai.assist.generating") : t("ai.assist.generate")}
            </Button>
            {result?.dormant && (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{result.message}</p>
            )}
            {result && !result.dormant && result.output && (
              <div className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-sm">
                {renderPreview(result.output)}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={close}>{t("ai.assist.cancel")}</Button>
            <Button onClick={apply} disabled={!result?.output || Boolean(result?.dormant)}>
              {applyLabel ?? t("ai.assist.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
