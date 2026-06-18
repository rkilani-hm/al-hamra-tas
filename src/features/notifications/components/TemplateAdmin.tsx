// Module M0.4 — notification template admin: list + bilingual editor + live
// preview (via preview_template RPC). Writes are service-role until M3.1, so
// save/activate fail-soft with a toast for authenticated users.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Eye, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTemplates, previewTemplate, safe, updateTemplate } from "../api";
import type { NotificationTemplate, RenderedTemplate, TemplateStatus } from "../types";

const STATUS_VARIANT: Record<TemplateStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

export function TemplateAdmin() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["notifications", "templates"], queryFn: safe(listTemplates) });
  const templates = q.data ?? [];

  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [subjectEn, setSubjectEn] = useState("");
  const [subjectAr, setSubjectAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [preview, setPreview] = useState<RenderedTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setSubjectEn(editing.subject_en ?? "");
      setSubjectAr(editing.subject_ar ?? "");
      setBodyEn(editing.body_en ?? "");
      setBodyAr(editing.body_ar ?? "");
      setPreview(null);
    }
  }, [editing]);

  const runPreview = async () => {
    if (!editing) return;
    // Sample context: each declared variable -> a readable placeholder value.
    const sample: Record<string, string> = {};
    for (const v of editing.variables_json ?? []) sample[v] = `[${v}]`;
    try {
      const r = await previewTemplate(editing.id, sample);
      setPreview(r);
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    }
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateTemplate(editing.id, {
        subject_en: subjectEn,
        subject_ar: subjectAr,
        body_en: bodyEn,
        body_ar: bodyAr,
      });
      toast.success(t("notifications.toasts.saved"));
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["notifications", "templates"] });
    } catch {
      toast.error(t("notifications.toasts.actionError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("notifications.template.typeCode")}</TableHead>
              <TableHead className="text-start">{t("notifications.template.channel")}</TableHead>
              <TableHead className="text-start">{t("notifications.template.version")}</TableHead>
              <TableHead className="text-start">{t("notifications.template.status")}</TableHead>
              <TableHead className="text-end">{t("notifications.template.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  {t("notifications.template.empty")}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">
                    {t(`notifications.typeCode.${tpl.type_code}`, { defaultValue: tpl.type_code })}
                  </TableCell>
                  <TableCell><Badge variant="outline">{t(`notifications.channel.${tpl.channel}`)}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">v{tpl.version}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[tpl.status]}>
                      {t(`notifications.templateStatus.${tpl.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("notifications.buttons.edit")} onClick={() => setEditing(tpl)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("notifications.template.editTitle")}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{editing.type_code}</Badge>
                <Badge variant="outline">{t(`notifications.channel.${editing.channel}`)}</Badge>
              </div>

              {/* Placeholder helper */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-muted-foreground">{t("notifications.template.placeholders")}:</span>
                {(editing.variables_json ?? []).map((v) => (
                  <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{${v}}}`}</code>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>{t("notifications.template.subjectEn")}</Label>
                  <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("notifications.template.subjectAr")}</Label>
                  <Input dir="rtl" value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("notifications.template.bodyEn")}</Label>
                  <Textarea rows={5} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t("notifications.template.bodyAr")}</Label>
                  <Textarea rows={5} dir="rtl" value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={runPreview}>
                  <Eye className="h-4 w-4" /> {t("notifications.template.preview")}
                </Button>
                {preview && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-semibold text-foreground">{preview.subject}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview.body}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {t("notifications.buttons.cancel")}
            </Button>
            <Button onClick={save} disabled={saving}>
              {t("notifications.buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
