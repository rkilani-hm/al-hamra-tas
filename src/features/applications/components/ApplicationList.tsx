// Module M1.5 — applications list (global or per-requisition) with filters +
// a New Application dialog (create_application; handles duplicate-active).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { listRequisitions } from "@/features/requisition/api";
import {
  createApplication,
  listApplications,
  listCandidates,
  listPipelineStages,
  safe,
} from "../api";
import type { ApplicationFilter, ApplicationStatus } from "../types";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";

const STATUSES: ApplicationStatus[] = ["active", "hired", "rejected", "withdrawn", "on_hold"];
const ALL = "__all__";

interface ApplicationListProps {
  requisitionId?: string | null;
  currentUserId?: string | null;
}

export function ApplicationList({ requisitionId = null, currentUserId = null }: ApplicationListProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const [stageId, setStageId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [applied, setApplied] = useState<ApplicationFilter>({ requisitionId });

  const stagesQ = useQuery({ queryKey: ["applications", "stages"], queryFn: safe(listPipelineStages) });
  const stages = stagesQ.data ?? [];

  const q = useQuery({
    queryKey: ["applications", "list", applied],
    queryFn: safe(() => listApplications({ ...applied, requisitionId })),
  });
  const rows = q.data ?? [];

  const stageName = (r: { stage_name_en: string | null; stage_name_ar: string | null }) =>
    (language === "ar" ? r.stage_name_ar : r.stage_name_en) || r.stage_name_en || "—";
  const candName = (r: { candidate_name_en: string | null; candidate_name_ar: string | null }) =>
    (language === "ar" ? r.candidate_name_ar : r.candidate_name_en) || r.candidate_name_en || "—";

  const runSearch = () => {
    setApplied({
      requisitionId,
      stageId: stageId === ALL ? null : stageId,
      status: status === ALL ? null : status,
      candidateSearch: search || null,
      mine,
    });
  };

  // New Application dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newReq, setNewReq] = useState(requisitionId ?? "");
  const [newCand, setNewCand] = useState("");
  const [newSource, setNewSource] = useState("");
  const [creating, setCreating] = useState(false);
  const reqsQ = useQuery({ queryKey: ["applications", "reqs"], queryFn: safe(() => listRequisitions({})), enabled: newOpen });
  const candsQ = useQuery({ queryKey: ["applications", "cands"], queryFn: safe(() => listCandidates()), enabled: newOpen });

  const createNew = async () => {
    if (!newReq || !newCand) return;
    setCreating(true);
    try {
      await createApplication(newReq, newCand, newSource || null);
      toast.success(t("applications.toasts.created"));
      setNewOpen(false);
      setNewCand("");
      setNewSource("");
      await qc.invalidateQueries({ queryKey: ["applications", "list"] });
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? "");
      toast.error(msg.includes("duplicate_active_application") ? t("applications.validation.duplicate") : t("applications.toasts.actionError"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">{t("applications.list.title")}</h2>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-1">
            <Link to="/app/applications/board">{t("applications.list.board")}</Link>
          </Button>
          <Button className="gap-1" onClick={() => { setNewReq(requisitionId ?? ""); setNewOpen(true); }}>
            <Plus className="h-4 w-4" /> {t("applications.list.new")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("applications.filter.stage")}</Label>
          <Select value={stageId} onValueChange={setStageId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("applications.filter.allStages")}</SelectItem>
              {stages.map((s) => <SelectItem key={s.id} value={s.id}>{language === "ar" ? s.name_ar : s.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("applications.filter.status")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("applications.filter.allStatuses")}</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`applications.status.${s}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("applications.filter.candidate")}</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("applications.filter.candidatePlaceholder")} />
        </div>
        <div className="flex items-end gap-2">
          <Button variant={mine ? "default" : "outline"} onClick={() => setMine((v) => !v)} disabled={!currentUserId} title={!currentUserId ? t("applications.filter.mineSignIn") : undefined}>
            {t("applications.filter.mine")}
          </Button>
          <Button className="gap-1" onClick={runSearch}><Search className="h-4 w-4" /> {t("applications.filter.search")}</Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("applications.table.reference")}</TableHead>
              <TableHead className="text-start">{t("applications.table.candidate")}</TableHead>
              <TableHead className="text-start">{t("applications.table.requisition")}</TableHead>
              <TableHead className="text-start">{t("applications.table.stage")}</TableHead>
              <TableHead className="text-start">{t("applications.table.status")}</TableHead>
              <TableHead className="text-start">{t("applications.table.applied")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">{t("applications.list.empty")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/app/applications/$id" params={{ id: r.id }} className="font-medium text-primary hover:underline">
                      {r.reference ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{candName(r)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.requisition_reference ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{stageName(r)}</Badge></TableCell>
                  <TableCell><ApplicationStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">{new Date(r.applied_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* New application */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("applications.list.new")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.table.requisition")}</Label>
              <Select value={newReq || undefined} onValueChange={setNewReq} disabled={Boolean(requisitionId)}>
                <SelectTrigger><SelectValue placeholder={t("applications.common.select")} /></SelectTrigger>
                <SelectContent>
                  {(reqsQ.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.reference ?? r.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.table.candidate")}</Label>
              <Select value={newCand || undefined} onValueChange={setNewCand}>
                <SelectTrigger><SelectValue placeholder={t("applications.common.select")} /></SelectTrigger>
                <SelectContent>
                  {(candsQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{(language === "ar" ? c.full_name_ar : c.full_name_en) || c.email || c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.source")}</Label>
              <Input value={newSource} onChange={(e) => setNewSource(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>{t("applications.actions.cancel")}</Button>
            <Button onClick={createNew} disabled={creating || !newReq || !newCand}>{t("applications.actions.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
