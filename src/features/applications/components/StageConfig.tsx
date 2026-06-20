// Module M1.5 — pipeline stage admin (list / reorder / activate-deactivate).
// Writes are service-role until M3.1 → fail-soft toasts. Deactivating a stage
// hides it from new moves; existing applications keep their stage.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { isSystemAdmin } from "@/features/admin/RequireAdmin";
import { listAllStages, safe, updateStage } from "../api";
import type { PipelineStage } from "../types";

export function StageConfig() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { roles } = useAuth();
  const canWrite = isSystemAdmin(roles);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["applications", "allStages"], queryFn: safe(listAllStages) });
  const stages = q.data ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["applications", "allStages"] });

  // Reorder by swapping sort_order with the neighbor (two writes; fail-soft).
  const move = async (i: number, dir: -1 | 1) => {
    const a = stages[i];
    const b = stages[i + dir];
    if (!a || !b) return;
    try {
      await updateStage(a.id, { sort_order: b.sort_order });
      await updateStage(b.id, { sort_order: a.sort_order });
      toast.success(t("applications.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("applications.toasts.actionError"));
    }
  };

  const toggle = async (s: PipelineStage, next: boolean) => {
    try {
      await updateStage(s.id, { status: next ? "active" : "inactive" });
      toast.success(t("applications.toasts.saved"));
      await refresh();
    } catch {
      toast.error(t("applications.toasts.actionError"));
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-foreground">{t("applications.stages.title")}</h3>
      <p className="text-xs text-muted-foreground">{t("applications.stages.hint")}</p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("applications.stages.order")}</TableHead>
              <TableHead className="text-start">{t("applications.stages.name")}</TableHead>
              <TableHead className="text-start">{t("applications.stages.type")}</TableHead>
              <TableHead className="text-start">{t("applications.stages.active")}</TableHead>
              <TableHead className="text-end">{t("applications.stages.reorder")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : stages.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t("applications.stages.empty")}</TableCell></TableRow>
            ) : (
              stages.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{s.sort_order}</TableCell>
                  <TableCell className="font-medium">{language === "ar" ? s.name_ar : s.name_en}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_terminal ? "outline" : "secondary"}>
                      {t(`applications.stageType.${s.stage_type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={s.status === "active"} onCheckedChange={(v) => toggle(s, v)} aria-label={s.code} disabled={!canWrite} />
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("applications.stages.up")} onClick={() => move(i, -1)} disabled={i === 0 || !canWrite}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("applications.stages.down")} onClick={() => move(i, 1)} disabled={i === stages.length - 1 || !canWrite}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
