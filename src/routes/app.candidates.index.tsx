// Route: /app/candidates — Module M1.5 candidate list + create.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Search, UserSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listCandidates, safe } from "@/features/applications/api";

export const Route = createFileRoute("/app/candidates/")({
  head: () => ({
    meta: [
      { title: "Candidates — Al Hamra TAS" },
      { name: "description", content: "Candidate directory." },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const q = useQuery({ queryKey: ["candidates", "list", applied], queryFn: safe(() => listCandidates(applied)) });
  const candidates = q.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserSearch className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("applications.candidate.pageTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("applications.candidate.subtitle")}</p>
          </div>
        </div>
        <Button className="gap-1" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> {t("applications.candidate.new")}</Button>
      </header>

      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("applications.candidate.searchPlaceholder")} className="sm:max-w-xs" />
        <Button variant="outline" className="gap-1" onClick={() => setApplied(search)}><Search className="h-4 w-4" /> {t("applications.filter.search")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("applications.candidate.name")}</TableHead>
              <TableHead className="text-start">{t("applications.candidate.email")}</TableHead>
              <TableHead className="text-start">{t("applications.candidate.nationalityClass")}</TableHead>
              <TableHead className="text-start">{t("applications.candidate.currentTitle")}</TableHead>
              <TableHead className="text-start">{t("applications.candidate.statusLabel")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell></TableRow>
            ) : candidates.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">{t("applications.candidate.empty")}</TableCell></TableRow>
            ) : (
              candidates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/app/candidates/$id" params={{ id: c.id }} className="font-medium text-primary hover:underline">
                      {(language === "ar" ? c.full_name_ar : c.full_name_en) || c.full_name_en || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.nationality_class ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.current_title ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{t(`applications.candidateStatus.${c.status}`)}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CandidateForm open={formOpen} onOpenChange={setFormOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["candidates", "list"] })} />
    </div>
  );
}
