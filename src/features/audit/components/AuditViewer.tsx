// Module M0.5 — searchable audit viewer: filter bar + paged immutable table
// with expandable detail_json and a source badge. Bilingual, RTL-safe.
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { searchAudit, safe } from "../api";
import type { AuditFilter } from "../types";

const PAGE = 50;

export function AuditViewer() {
  const { t } = useTranslation();

  const [draft, setDraft] = useState<AuditFilter>({});
  const [applied, setApplied] = useState<AuditFilter>({});
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["audit", "search", applied, page],
    queryFn: safe(() => searchAudit({ ...applied, limit: PAGE, offset: page * PAGE })),
  });
  const rows = q.data ?? [];

  const runSearch = () => {
    setPage(0);
    setApplied(draft);
  };
  const set = (patch: Partial<AuditFilter>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.module")}</Label>
          <Input value={draft.module ?? ""} onChange={(e) => set({ module: e.target.value || null })} placeholder="M0.5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.eventType")}</Label>
          <Input value={draft.eventType ?? ""} onChange={(e) => set({ eventType: e.target.value || null })} placeholder="document.uploaded" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.actor")}</Label>
          <Input value={draft.actor ?? ""} onChange={(e) => set({ actor: e.target.value || null })} placeholder="user id" dir="ltr" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.entityRef")}</Label>
          <Input value={draft.entityRef ?? ""} onChange={(e) => set({ entityRef: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.from")}</Label>
          <Input type="date" value={draft.from ?? ""} onChange={(e) => set({ from: e.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">{t("audit.filter.to")}</Label>
          <Input type="date" value={draft.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} />
        </div>
        <div className="flex items-end">
          <Button className="gap-1" onClick={runSearch}>
            <Search className="h-4 w-4" /> {t("audit.filter.search")}
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="text-start">{t("audit.table.time")}</TableHead>
              <TableHead className="text-start">{t("audit.table.module")}</TableHead>
              <TableHead className="text-start">{t("audit.table.event")}</TableHead>
              <TableHead className="text-start">{t("audit.table.entity")}</TableHead>
              <TableHead className="text-start">{t("audit.table.actor")}</TableHead>
              <TableHead className="text-start">{t("audit.table.source")}</TableHead>
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
                  {t("audit.table.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((e) => {
                const key = `${e.source}-${e.id}`;
                const isOpen = expanded === key;
                const hasDetail = e.detail_json && Object.keys(e.detail_json).length > 0;
                return (
                  <Fragment key={key}>
                    <TableRow>
                      <TableCell>
                        {hasDetail && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("audit.table.toggle")} onClick={() => setExpanded(isOpen ? null : key)}>
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground" dir="ltr">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{e.module_code && <Badge variant="outline">{e.module_code}</Badge>}</TableCell>
                      <TableCell className="font-medium">{e.event_type}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.entity_type ? `${e.entity_type}${e.entity_ref ? `:${e.entity_ref}` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground" dir="ltr">{e.actor_user_id ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.source === "audit_log" ? "secondary" : "outline"}>
                          {t(`audit.source.${e.source}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isOpen && hasDetail && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <pre className="overflow-x-auto p-2 text-xs text-muted-foreground" dir="ltr">
                            {JSON.stringify(e.detail_json, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pager */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t("audit.pager.prev")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("audit.pager.page", { page: page + 1 })}</span>
        <Button variant="outline" size="sm" disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}>
          {t("audit.pager.next")}
        </Button>
      </div>
    </div>
  );
}
