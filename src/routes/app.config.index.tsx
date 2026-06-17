// Route: /app/config — Module M0.2 Core Configuration landing.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Building2, Briefcase, FileText, ListChecks, Settings2 } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/config/")({
  head: () => ({
    meta: [
      { title: "Core Configuration — Al Hamra TAS" },
      { name: "description", content: "Organization, job catalog, JD templates, and lookups." },
    ],
  }),
  component: ConfigLanding,
});

function ConfigLanding() {
  const { t } = useTranslation();

  const sections = [
    { to: "/app/config/org", icon: Building2, title: t("config.org.title"), desc: t("config.landing.orgDesc") },
    { to: "/app/config/jobs", icon: Briefcase, title: t("config.jobs.title"), desc: t("config.landing.jobsDesc") },
    { to: "/app/config/jd", icon: FileText, title: t("config.jd.title"), desc: t("config.landing.jdDesc") },
    { to: "/app/config/lookups", icon: ListChecks, title: t("config.lookups.title"), desc: t("config.landing.lookupsDesc") },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Settings2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("config.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("config.page.subtitle")}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <s.icon className="h-5 w-5 text-primary" />
                  {s.title}
                </CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
