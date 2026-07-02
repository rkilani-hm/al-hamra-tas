// Route: /app/candidates/:id — Module M1.5 candidate detail + their applications.
import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { CandidateForm } from "@/features/applications/components/CandidateForm";
import { ApplicationStatusBadge } from "@/features/applications/components/ApplicationStatusBadge";
import { ConsentPanel } from "@/features/consent/components/ConsentPanel";
import { applicationsForCandidate, getCandidate, safe } from "@/features/applications/api";

export const Route = createFileRoute("/app/candidates/$id")({
  head: () => ({ meta: [{ title: "Candidate — Al Hamra TAS" }] }),
  component: CandidateDetailPage,
});

function CandidateDetailPage() {
  const { t } = useTranslation();
  const { language, direction } = useLanguage();
  const { id } = useParams({ from: "/app/candidates/$id" });
  const qc = useQueryClient();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  const [editOpen, setEditOpen] = useState(false);

  const candQ = useQuery({ queryKey: ["candidates", "detail", id], queryFn: () => getCandidate(id) });
  const appsQ = useQuery({ queryKey: ["candidates", "apps", id], queryFn: safe(() => applicationsForCandidate(id)) });
  const c = candQ.data ?? null;
  const apps = appsQ.data ?? [];

  const name = c ? (language === "ar" ? c.full_name_ar : c.full_name_en) || c.full_name_en || c.email : "";

  return (
    <div className="space-y-6">
      <Link to="/app/candidates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("applications.candidate.backToList")}
      </Link>

      {candQ.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("applications.common.loading")}</p>
      ) : !c ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("applications.candidate.notFound")}</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
            <Button variant="outline" className="gap-1" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> {t("applications.actions.edit")}
            </Button>
          </header>

          <section className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
            <Field label={t("applications.candidate.email")} value={c.email ?? "—"} />
            <Field label={t("applications.candidate.phone")} value={c.phone ?? "—"} />
            <Field label={t("applications.candidate.nationality")} value={c.nationality ?? "—"} />
            <Field label={t("applications.candidate.nationalityClass")} value={c.nationality_class ?? "—"} />
            <Field label={t("applications.candidate.currentTitle")} value={c.current_title ?? "—"} />
            <Field label={t("applications.candidate.source")} value={c.source ?? "—"} />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{t("applications.candidate.theirApplications")}</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t("applications.table.reference")}</TableHead>
                    <TableHead className="text-start">{t("applications.table.requisition")}</TableHead>
                    <TableHead className="text-start">{t("applications.table.stage")}</TableHead>
                    <TableHead className="text-start">{t("applications.table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">{t("applications.candidate.noApplications")}</TableCell></TableRow>
                  ) : (
                    apps.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link to="/app/applications/$id" params={{ id: a.id }} className="font-medium text-primary hover:underline">{a.reference ?? "—"}</Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.requisition_reference ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{(language === "ar" ? a.stage_name_ar : a.stage_name_en) || "—"}</Badge></TableCell>
                        <TableCell><ApplicationStatusBadge status={a.status} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{t("consent.title")}</h2>
            <ConsentPanel candidateId={id} />
          </section>

          <CandidateForm
            open={editOpen}
            onOpenChange={setEditOpen}
            initial={c}
            onSaved={() => { qc.invalidateQueries({ queryKey: ["candidates", "detail", id] }); }}
          />
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}
