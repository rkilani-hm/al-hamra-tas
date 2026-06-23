// Module M0.2 — Core Configuration: Job Catalog (Families / Grades / Positions).
// Tabs with tables + bilingual create/edit dialogs. RTL-safe.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  createJobFamily,
  createJobGrade,
  createJobPosition,
  listJobFamilies,
  listJobGrades,
  listJobPositions,
  safe,
  updateJobFamily,
  updateJobGrade,
  updateJobPosition,
} from "../api";
import type { JobFamily, JobGrade, JobPosition } from "../types";

type Kind = "family" | "grade" | "position";

export function JobCatalog() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("config.manage");
  const qc = useQueryClient();

  const familiesQ = useQuery({ queryKey: ["config", "jobFamilies"], queryFn: safe(listJobFamilies) });
  const gradesQ = useQuery({ queryKey: ["config", "jobGrades"], queryFn: safe(listJobGrades) });
  const positionsQ = useQuery({ queryKey: ["config", "jobPositions"], queryFn: safe(listJobPositions) });

  const families = familiesQ.data ?? [];
  const grades = gradesQ.data ?? [];
  const positions = positionsQ.data ?? [];

  const name = (o: { name_en: string; name_ar: string }) =>
    language === "ar" ? o.name_ar : o.name_en;

  // Shared form state
  const [kind, setKind] = useState<Kind>("family");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobFamily | JobGrade | JobPosition | null>(null);
  const [saving, setSaving] = useState(false);

  // Field state
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [rank, setRank] = useState("");
  const [familyId, setFamilyId] = useState<string>("");
  const [gradeId, setGradeId] = useState<string>("");
  const [kt, setKt] = useState(false);

  useEffect(() => {
    if (!open) return;
    const e = editing as Partial<JobFamily & JobGrade & JobPosition> | null;
    setCode(e?.code ?? "");
    setNameEn(e?.name_en ?? "");
    setNameAr(e?.name_ar ?? "");
    setRank(e && "rank" in e && e.rank != null ? String(e.rank) : "");
    setFamilyId((e && "job_family_id" in e && e.job_family_id) || "");
    setGradeId((e && "job_grade_id" in e && e.job_grade_id) || "");
    setKt((e && "is_kuwaitization_targeted" in e && e.is_kuwaitization_targeted) || false);
  }, [open, editing]);

  const openForm = (k: Kind, record: JobFamily | JobGrade | JobPosition | null) => {
    setKind(k);
    setEditing(record);
    setOpen(true);
  };

  const invalidate = (key: string) => qc.invalidateQueries({ queryKey: ["config", key] });
  const canSave = code.trim() && nameEn.trim() && nameAr.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (kind === "family") {
        const v = { code: code.trim(), name_en: nameEn.trim(), name_ar: nameAr.trim(), status: "active" };
        if (editing) await updateJobFamily(editing.id, v);
        else await createJobFamily(v);
        await invalidate("jobFamilies");
      } else if (kind === "grade") {
        const v = {
          code: code.trim(),
          name_en: nameEn.trim(),
          name_ar: nameAr.trim(),
          rank: rank.trim() ? Number(rank) : null,
          status: "active",
        };
        if (editing) await updateJobGrade(editing.id, v);
        else await createJobGrade(v);
        await invalidate("jobGrades");
      } else {
        const v = {
          code: code.trim(),
          name_en: nameEn.trim(),
          name_ar: nameAr.trim(),
          job_family_id: familyId || null,
          job_grade_id: gradeId || null,
          is_kuwaitization_targeted: kt,
          status: "active",
        };
        if (editing) await updateJobPosition(editing.id, v);
        else await createJobPosition(v);
        await invalidate("jobPositions");
      }
      toast.success(t("config.toasts.saved"));
      setOpen(false);
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const familyName = useMemo(() => {
    const m = new Map(families.map((f) => [f.id, name(f)]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, language]);
  const gradeName = useMemo(() => {
    const m = new Map(grades.map((g) => [g.id, name(g)]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, language]);

  const addLabel: Record<Kind, string> = {
    family: t("config.jobs.addFamily"),
    grade: t("config.jobs.addGrade"),
    position: t("config.jobs.addPosition"),
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="families">
        <TabsList>
          <TabsTrigger value="families">{t("config.jobs.families")}</TabsTrigger>
          <TabsTrigger value="grades">{t("config.jobs.grades")}</TabsTrigger>
          <TabsTrigger value="positions">{t("config.jobs.positions")}</TabsTrigger>
        </TabsList>

        {/* Families */}
        <TabsContent value="families" className="space-y-3">
          {canWrite && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => openForm("family", null)}>
                <Plus className="h-4 w-4" /> {addLabel.family}
              </Button>
            </div>
          )}
          <SimpleTable
            cols={[t("config.fields.code"), t("config.fields.name"), ""]}
            empty={t("config.jobs.emptyFamilies")}
            loading={familiesQ.isLoading}
            rows={families.map((f) => ({
              id: f.id,
              cells: [f.code, name(f)],
              onEdit: () => openForm("family", f),
            }))}
            editLabel={t("config.buttons.edit")}
            canEdit={canWrite}
          />
        </TabsContent>

        {/* Grades */}
        <TabsContent value="grades" className="space-y-3">
          {canWrite && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => openForm("grade", null)}>
                <Plus className="h-4 w-4" /> {addLabel.grade}
              </Button>
            </div>
          )}
          <SimpleTable
            cols={[t("config.fields.code"), t("config.fields.name"), t("config.fields.rank"), ""]}
            empty={t("config.jobs.emptyGrades")}
            loading={gradesQ.isLoading}
            rows={grades.map((g) => ({
              id: g.id,
              cells: [g.code, name(g), g.rank != null ? String(g.rank) : "—"],
              onEdit: () => openForm("grade", g),
            }))}
            editLabel={t("config.buttons.edit")}
            canEdit={canWrite}
          />
        </TabsContent>

        {/* Positions */}
        <TabsContent value="positions" className="space-y-3">
          {canWrite && (
            <div className="flex justify-end">
              <Button size="sm" className="gap-1" onClick={() => openForm("position", null)}>
                <Plus className="h-4 w-4" /> {addLabel.position}
              </Button>
            </div>
          )}
          <SimpleTable
            cols={[
              t("config.fields.code"),
              t("config.fields.name"),
              t("config.fields.jobFamily"),
              t("config.fields.jobGrade"),
              t("config.fields.kuwaitization"),
              "",
            ]}
            empty={t("config.jobs.emptyPositions")}
            loading={positionsQ.isLoading}
            rows={positions.map((p) => ({
              id: p.id,
              cells: [
                p.code,
                name(p),
                familyName(p.job_family_id),
                gradeName(p.job_grade_id),
                p.is_kuwaitization_targeted ? t("config.common.yes") : t("config.common.no"),
              ],
              onEdit: () => openForm("position", p),
            }))}
            editLabel={t("config.buttons.edit")}
            canEdit={canWrite}
          />
        </TabsContent>
      </Tabs>

      {/* Shared add/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("config.buttons.edit") : addLabel[kind]}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jc-code">{t("config.fields.code")}</Label>
              <Input id="jc-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jc-en">{t("config.fields.nameEn")}</Label>
                <Input id="jc-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="jc-ar">{t("config.fields.nameAr")}</Label>
                <Input id="jc-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
            </div>

            {kind === "grade" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="jc-rank">{t("config.fields.rank")}</Label>
                <Input id="jc-rank" type="number" value={rank} onChange={(e) => setRank(e.target.value)} />
              </div>
            )}

            {kind === "position" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>{t("config.fields.jobFamily")}</Label>
                    <Select value={familyId || undefined} onValueChange={setFamilyId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("config.common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {families.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {name(f)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>{t("config.fields.jobGrade")}</Label>
                    <Select value={gradeId || undefined} onValueChange={setGradeId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("config.common.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {name(g)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="jc-kt">{t("config.fields.kuwaitization")}</Label>
                  <Switch id="jc-kt" checked={kt} onCheckedChange={setKt} />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("config.buttons.cancel")}
            </Button>
            <Button onClick={submit} disabled={!canSave || !canWrite}>
              {t("config.buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small local table helper to keep the three tabs consistent.
interface SimpleRow {
  id: string;
  cells: string[];
  onEdit: () => void;
}
function SimpleTable({
  cols,
  rows,
  empty,
  loading,
  editLabel,
  canEdit,
}: {
  cols: string[];
  rows: SimpleRow[];
  empty: string;
  loading?: boolean;
  editLabel: string;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c, i) => (
              <TableHead key={i} className={i === cols.length - 1 ? "text-end" : "text-start"}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={cols.length} className="h-16 text-center text-muted-foreground">
                …
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={cols.length} className="h-16 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                {r.cells.map((cell, i) => (
                  <TableCell key={i} className={i === 0 ? "font-medium" : ""}>
                    {i === 0 ? <Badge variant="outline">{cell}</Badge> : cell}
                  </TableCell>
                ))}
                <TableCell className="text-end">
                  {canEdit ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={editLabel} onClick={r.onEdit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
