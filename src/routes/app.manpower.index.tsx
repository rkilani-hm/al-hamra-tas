// Route: /app/manpower — Module M1.1 Manpower Planning & Headcount.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Users, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { listDepartments, listEntities, listJobPositions, safe as configSafe } from "@/features/config/api";
import { listManpowerPlans, safe, setManpowerStatus, upsertManpowerPlan } from "@/features/manpower/api";
import type { ManpowerStatus } from "@/features/manpower/types";

export const Route = createFileRoute("/app/manpower/")({
  head: () => ({
    meta: [
      { title: "Manpower Planning — Al Hamra TAS" },
      { name: "description", content: "Budgeted headcount planning and Kuwaitization targets." },
    ],
  }),
  component: ManpowerPage,
});

const STATUSES: ManpowerStatus[] = ["draft", "active", "closed"];

function ManpowerPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("manpower.manage");
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [year, setYear] = useState("2026");
  const [entity, setEntity] = useState("");
  const [dept, setDept] = useState("");
  const [position, setPosition] = useState("");
  const [budget, setBudget] = useState("1");
  const [kuwait, setKuwait] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["manpower", "all"], queryFn: safe(() => listManpowerPlans()) });
  const plans = q.data ?? [];
  const entitiesQ = useQuery({ queryKey: ["manpower", "entities"], queryFn: configSafe(() => listEntities()), enabled: open });
  const deptsQ = useQuery({ queryKey: ["manpower", "depts"], queryFn: configSafe(() => listDepartments()), enabled: open });
  const posQ = useQuery({ queryKey: ["manpower", "positions"], queryFn: configSafe(() => listJobPositions()), enabled: open });

  const refresh = () => qc.invalidateQueries({ queryKey: ["manpower", "all"] });
  const nm = (o: { name_en: string; name_ar: string } | undefined) => (o ? (language === "ar" ? o.name_ar : o.name_en) : "—");
  const deptName = (id: string | null) => nm((deptsQ.data ?? []).find((d) => d.id === id));
  const posName = (id: string | null) => nm((posQ.data ?? []).find((p) => p.id === id));

  const openNew = () => {
    setEditId(null); setYear("2026"); setEntity(""); setDept(""); setPosition(""); setBudget("1"); setKuwait("");
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await upsertManpowerPlan({
        id: editId,
        fiscal_year: Number(year) || new Date().getFullYear(),
        entity_id: entity || null,
        department_id: dept || null,
        job_position_id: position || null,
        budgeted_headcount: Number(budget) || 0,
        kuwaitization_target_pct: kuwait === "" ? null : Number(kuwait),
        notes: null,
      });
      toast.success(t("manpower.toasts.saved"));
      setOpen(false);
      await refresh();
    } catch {
      toast.error(t("manpower.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onStatus = async (id: string, status: string) => {
    try {
      await setManpowerStatus(id, status);
      await refresh();
    } catch {
      toast.error(t("manpower.toasts.actionError"));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("manpower.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("manpower.page.subtitle")}</p>
          </div>
        </div>
        {canManage && (
          <Button className="gap-1" onClick={openNew}><Plus className="h-4 w-4" /> {t("manpower.actions.new")}</Button>
        )}
      </header>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("manpower.table.year")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.department")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.position")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.budgeted")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.openReqs")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.kuwaitization")}</TableHead>
              <TableHead className="text-start">{t("manpower.table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : plans.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">{t("manpower.page.empty")}</TableCell></TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell dir="ltr">{p.fiscal_year}</TableCell>
                  <TableCell>{deptName(p.department_id)}</TableCell>
                  <TableCell>{posName(p.job_position_id)}</TableCell>
                  <TableCell dir="ltr">{p.budgeted_headcount}</TableCell>
                  <TableCell dir="ltr">
                    <Badge variant={p.open_requisitions > p.budgeted_headcount ? "destructive" : "outline"}>{p.open_requisitions}</Badge>
                  </TableCell>
                  <TableCell dir="ltr">{p.kuwaitization_target_pct != null ? `${p.kuwaitization_target_pct}%` : "—"}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select value={p.status} onValueChange={(v) => onStatus(p.id, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`manpower.status.${s}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{t(`manpower.status.${p.status}`)}</Badge>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("manpower.actions.new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.table.year")}</Label>
                <Input type="number" dir="ltr" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.table.budgeted")}</Label>
                <Input type="number" min={0} dir="ltr" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.form.entity")}</Label>
                <Select value={entity || undefined} onValueChange={setEntity}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(entitiesQ.data ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{nm(e)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.table.department")}</Label>
                <Select value={dept || undefined} onValueChange={setDept}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(deptsQ.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{nm(d)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.table.position")}</Label>
                <Select value={position || undefined} onValueChange={setPosition}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(posQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{nm(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("manpower.table.kuwaitization")} (%)</Label>
                <Input type="number" min={0} max={100} dir="ltr" value={kuwait} onChange={(e) => setKuwait(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t("manpower.actions.cancel")}</Button>
            <Button onClick={save} disabled={busy || !canManage}>{t("manpower.actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
