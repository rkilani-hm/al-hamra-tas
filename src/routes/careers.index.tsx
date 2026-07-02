// Route: /careers — Module M1.4 public careers portal (list). No auth required.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Briefcase, Languages } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { listPublicJobs, safe } from "@/features/careers/api";

export const Route = createFileRoute("/careers/")({
  head: () => ({
    meta: [
      { title: "Careers — Al Hamra Real Estate Group" },
      { name: "description", content: "Explore career opportunities at Al Hamra Real Estate Group." },
    ],
  }),
  component: CareersPage,
});

function CareersPage() {
  const { t } = useTranslation();
  const { language, direction, toggle } = useLanguage();

  const q = useQuery({ queryKey: ["careers", "jobs"], queryFn: safe(() => listPublicJobs()) });
  const jobs = q.data ?? [];

  return (
    <div dir={direction} className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t("careers.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("careers.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={toggle}>
          <Languages className="h-4 w-4" /> {language === "en" ? "العربية" : "English"}
        </Button>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("careers.loading")}</p>
      ) : jobs.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{t("careers.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id} className="rounded-lg border p-4 transition hover:border-primary">
              <Link to="/careers/$id" params={{ id: j.id }} className="block">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-medium text-primary">
                    {(language === "ar" ? j.title_ar : j.title_en) || j.title_en || j.reference}
                  </h2>
                  {j.employment_type && <Badge variant="secondary">{j.employment_type}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(language === "ar" ? j.department_ar : j.department_en) || j.department_en || ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-12 border-t pt-4 text-center text-xs text-muted-foreground">
        {t("careers.footer")}
      </footer>
    </div>
  );
}
