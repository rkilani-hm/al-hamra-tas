// Module M0.3 — workflow definitions list (by request_type / version / status).
// Activate / archive actions + create. Writes are service-role until M3.1, so
// the mutating actions fail-soft with a toast for authenticated users.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil, CheckCircle2, Archive } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import {
  activateWorkflow,
  archiveDefinition,
  createDefinition,
  listDefinitions,
  safe,
} from "../api";
import type { DefinitionStatus, WorkflowDefinition } from "../types";

const STATUS_VARIANT: Record<
  DefinitionStatus,
  "default" | "secondary" | "outline"
> = { active: "default", draft: "secondary", archived: "outline" };

interface WorkflowListProps {
  onEdit: (def: WorkflowDefinition) => void;
}

export function WorkflowList({ onEdit }: WorkflowListProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["workflow", "definitions"], queryFn: safe(listDefinitions) });
  const defs = q.data ?? [];
  const name = (d: WorkflowDefinition) => (language === "ar" ? d.name_ar : d.name_en);

  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [version, setVersion] = useState("1");
  const [saving, setSaving] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["workflow", "definitions"] });

  const create = async () => {
    if (!requestType.trim() || !nameEn.trim() || !nameAr.trim()) return;
    setSaving(true);
    try {
      await createDefinition({
        request_type: requestType.trim(),
        version: Number(version) || 1,
        name_en: nameEn.trim(),
        name_ar: nameAr.trim(),
      });
      toast.success(t("workflow.toasts.saved"));
      setOpen(false);
      setRequestType("");
      setNameEn("");
      setNameAr("");
      setVersion("1");
      await invalidate();
    } catch {
      toast.error(t("workflow.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const doActivate = async (d: WorkflowDefinition) => {
    try {
      await activateWorkflow(d.id);
      toast.success(t("workflow.toasts.activated"));
      await invalidate();
    } catch {
      toast.error(t("workflow.toasts.actionError"));
    }
  };

  const doArchive = async (d: WorkflowDefinition) => {
    try {
      await archiveDefinition(d.id);
      toast.success(t("workflow.toasts.archived"));
      await invalidate();
    } catch {
      toast.error(t("workflow.toasts.actionError"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("workflow.defs.title")}</h2>
        <Button className="gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {t("workflow.defs.add")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("workflow.fields.requestType")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.name")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.version")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.status")}</TableHead>
              <TableHead className="text-end">{t("workflow.fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : defs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  {t("workflow.defs.empty")}
                </TableCell>
              </TableRow>
            ) : (
              defs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell><Badge variant="outline">{d.request_type}</Badge></TableCell>
                  <TableCell className="font-medium">{name(d)}</TableCell>
                  <TableCell className="text-muted-foreground">v{d.version}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status]}>
                      {t(`workflow.defStatus.${d.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("workflow.buttons.edit")} onClick={() => onEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {d.status !== "active" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("workflow.buttons.activate")} onClick={() => doActivate(d)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {d.status !== "archived" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("workflow.buttons.archive")} onClick={() => doArchive(d)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("workflow.defs.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-rt">{t("workflow.fields.requestType")}</Label>
                <Input id="wf-rt" value={requestType} onChange={(e) => setRequestType(e.target.value)} placeholder="leave_request" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-ver">{t("workflow.fields.version")}</Label>
                <Input id="wf-ver" type="number" min={1} value={version} onChange={(e) => setVersion(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-en">{t("workflow.fields.nameEn")}</Label>
                <Input id="wf-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wf-ar">{t("workflow.fields.nameAr")}</Label>
                <Input id="wf-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("workflow.buttons.cancel")}
            </Button>
            <Button onClick={create} disabled={saving || !requestType.trim() || !nameEn.trim() || !nameAr.trim()}>
              {t("workflow.buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
