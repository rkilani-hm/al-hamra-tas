// Route: /app/workflow — Module M0.3 Workflow & Approvals landing.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { GitBranch, Inbox, Workflow } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/workflow/")({
  head: () => ({
    meta: [
      { title: "Workflow & Approvals — Al Hamra TAS" },
      { name: "description", content: "Configurable approval workflows and your approval inbox." },
    ],
  }),
  component: WorkflowLanding,
});

function WorkflowLanding() {
  const { t } = useTranslation();
  const sections = [
    { to: "/app/workflow/defs", icon: GitBranch, title: t("workflow.defs.title"), desc: t("workflow.landing.defsDesc") },
    { to: "/app/workflow/inbox", icon: Inbox, title: t("workflow.inbox.title"), desc: t("workflow.landing.inboxDesc") },
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <Workflow className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("workflow.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("workflow.page.subtitle")}</p>
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
