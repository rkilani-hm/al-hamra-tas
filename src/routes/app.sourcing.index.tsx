// Route: /app/sourcing — Module M1.3 Candidate Sourcing & Talent Pool.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { UserSearch, Plus } from "lucide-react";

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
import { listCandidates, safe as appSafe } from "@/features/applications/api";
import { addToTalentPool, listTalentPool, safe, updatePoolStatus } from "@/features/sourcing/api";
import type { PoolStatus, SourceChannel } from "@/features/sourcing/types";

export const Route = createFileRoute("/app/sourcing/")({
  head: () => ({
    meta: [
      { title: "Sourcing & Talent Pool — Al Hamra TAS" },
      { name: "description", content: "Candidate sourcing channels and talent pool." },
    ],
  }),
  component: SourcingPage,
});

const CHANNELS: SourceChannel[] = ["internal", "referral", "agency", "database", "portal", "other"];
const STATUSES: PoolStatus[] = ["active", "passive", "placed", "archived"];
const ALL = "__all__";

function SourcingPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canManage = capabilities.includes("sourcing.manage");
  const qc = useQueryClient();

  const [channelFilter, setChannelFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [cand, setCand] = useState("");
  const [channel, setChannel] = useState<SourceChannel>("database");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["sourcing", channelFilter, statusFilter],
    queryFn: safe(() => listTalentPool(channelFilter === ALL ? null : channelFilter, statusFilter === ALL ? null : statusFilter)),
  });
  const rows = q.data ?? [];
  const candsQ = useQuery({ queryKey: ["sourcing", "cands"], queryFn: appSafe(() => listCandidates()), enabled: open });

  const refresh = () => qc.invalidateQueries({ queryKey: ["sourcing"] });
  const candName = (o: { full_name_en: string | null; full_name_ar: string | null } | undefined) =>
    o ? (language === "ar" ? o.full_name_ar : o.full_name_en) || o.full_name_en || "—" : "—";
  const rowName = (r: { candidate_name_en: string | null; candidate_name_ar: string | null }) =>
    (language === "ar" ? r.candidate_name_ar : r.candidate_name_en) || r.candidate_name_en || "—";

  const add = async () => {
    if (!cand) return;
    setBusy(true);
    try {
      await addToTalentPool({
        candidate_id: cand,
        source_channel: channel,
        agency_name: null,
        referred_by: null,
        tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        notes: null,
      });
      toast.success(t("sourcing.toasts.added"));
      setOpen(false); setCand(""); setTags("");
      await refresh();
    } catch {
      toast.error(t("sourcing.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  const onStatus = async (id: string, status: string) => {
    try { await updatePoolStatus(id, status); await refresh(); }
    catch { toast.error(t("sourcing.toasts.actionError")); }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserSearch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("sourcing.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("sourcing.page.subtitle")}</p>
          </div>
        </div>
        {canManage && <Button className="gap-1" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {t("sourcing.actions.add")}</Button>}
      </header>

      <div className="flex flex-wrap gap-2">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("sourcing.filter.allChannels")}</SelectItem>
            {CHANNELS.map((c) => <SelectItem key={c} value={c}>{t(`sourcing.channel.${c}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("sourcing.filter.allStatuses")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`sourcing.status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("sourcing.table.candidate")}</TableHead>
              <TableHead className="text-start">{t("sourcing.table.channel")}</TableHead>
              <TableHead className="text-start">{t("sourcing.table.tags")}</TableHead>
              <TableHead className="text-start">{t("sourcing.table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">{t("sourcing.page.empty")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{rowName(r)}</TableCell>
                  <TableCell>{t(`sourcing.channel.${r.source_channel}`)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).map((tg) => <Badge key={tg} variant="secondary" className="text-xs">{tg}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select value={r.pool_status} onValueChange={(v) => onStatus(r.id, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`sourcing.status.${s}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Badge variant="outline">{t(`sourcing.status.${r.pool_status}`)}</Badge>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sourcing.actions.add")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("sourcing.table.candidate")}</Label>
              <Select value={cand || undefined} onValueChange={setCand}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(candsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{candName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("sourcing.table.channel")}</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as SourceChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{t(`sourcing.channel.${c}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("sourcing.table.tags")}</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("sourcing.form.tagsHint")} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{t("sourcing.actions.cancel")}</Button>
            <Button onClick={add} disabled={busy || !cand || !canManage}>{t("sourcing.actions.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
