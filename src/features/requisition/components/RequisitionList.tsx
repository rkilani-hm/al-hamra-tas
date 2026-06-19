// Module M1.2 — org-scoped requisition list with filters + "mine".
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { listDepartments, listJobPositions, safe as configSafe } from "@/features/config/api";
import { listRequisitions, safe } from "../api";
import type { RequisitionFilter, RequisitionStatus } from "../types";
import { RequisitionStatusBadge } from "./RequisitionStatusBadge";

const STATUSES: RequisitionStatus[] = [
  "draft", "submitted", "in_approval", "approved", "published", "on_hold", "cancelled", "closed",
];
const ALL = "__all__";

interface RequisitionListProps {
  currentUserId?: string | null;
}

export function RequisitionList({ currentUserId = null }: RequisitionListProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [status, setStatus] = useState<string>(ALL);
  const [departmentId, setDepartmentId] = useState<string>(ALL);
  const [positionId, setPositionId] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mine, setMine] = useState(false);
  const [applied, setApplied] = useState<RequisitionFilter>({});

  const positionsQ = useQuery({ queryKey: ["requisition", "positions"], queryFn: configSafe(listJobPositions) });
  const departmentsQ = useQuery({ queryKey: ["requisition", "departments"], queryFn: configSafe(() => listDepartments()) });
  const positions = positionsQ.data ?? [];
  const departments = departmentsQ.data ?? [];

  const q = useQuery({
    queryKey: ["requisition", "list", applied],
    queryFn: safe(() => listRequisitions(applied)),
  });
  const rows = q.data ?? [];

  const name = (o: { name_en: string; name_ar: string }) => (language === "ar" ? o.name_ar : o.name_en);
  const title = (r: { title_en: string | null; title_ar: string | null; reference: string | null }) =>
    (language === "ar" ? r.title_ar : r.title_en) || r.title_en || r.title_ar || r.reference || "—";
  const positionName = (id: string) => {
    const p = positions.find((x) => x.id === id);
    return p ? name(p) : "—";
  };
  const deptName = (id: string | null) => {
    if (!id) return "—";
    const d = departments.find((x) => x.id === id);
    return d ? name(d) : "—";
  };

  const runSearch = () => {
    setApplied({
      status: status === ALL ? null : status,
      departmentId: departmentId === ALL ? null : departmentId,
      positionId: positionId === ALL ? null : positionId,
      from: from || null,
      to: to || null,
      mine,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t("requisition.list.title")}</h2>
        <Button asChild className="gap-1">
          <Link to="/app/requisitions/new"><Plus className="h-4 w-4" /> {t("requisition.list.new")}</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("requisition.filter.status")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("requisition.filter.allStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`requisition.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("requisition.filter.department")}</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("requisition.filter.allDepartments")}</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{name(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("requisition.filter.position")}</Label>
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("requisition.filter.allPositions")}</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{name(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("requisition.filter.from")}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("requisition.filter.to")}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          {/* "mine" gated on sign-in (currentUserId). Disabled stub when null. */}
          <Button
            variant={mine ? "default" : "outline"}
            onClick={() => setMine((v) => !v)}
            disabled={!currentUserId}
            title={!currentUserId ? t("requisition.filter.mineSignIn") : undefined}
          >
            {t("requisition.filter.mine")}
          </Button>
          <Button className="gap-1" onClick={runSearch}>
            <Search className="h-4 w-4" /> {t("requisition.filter.search")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("requisition.table.reference")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.title")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.position")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.department")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.headcount")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.status")}</TableHead>
              <TableHead className="text-start">{t("requisition.table.created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                  {t("requisition.list.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/app/requisitions/$id" params={{ id: r.id }} className="font-medium text-primary hover:underline">
                      {r.reference ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{title(r)}</TableCell>
                  <TableCell className="text-muted-foreground">{positionName(r.job_position_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{deptName(r.department_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.headcount}</TableCell>
                  <TableCell><RequisitionStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {new Date(r.created_at).toLocaleDateString()}
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
