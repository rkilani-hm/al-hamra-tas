// Route: /app/workflow/defs — definitions list + step builder.
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { WorkflowList } from "@/features/workflow/components/WorkflowList";
import { WorkflowBuilder } from "@/features/workflow/components/WorkflowBuilder";
import { useLanguage } from "@/hooks/use-language";
import type { WorkflowDefinition } from "@/features/workflow/types";

export const Route = createFileRoute("/app/workflow/defs")({
  head: () => ({ meta: [{ title: "Workflow Definitions — Al Hamra TAS" }] }),
  component: DefsPage,
});

function DefsPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const [selected, setSelected] = useState<WorkflowDefinition | null>(null);
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  return (
    <div className="space-y-4">
      <Link to="/app/workflow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("workflow.backToWorkflow")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("workflow.defs.pageTitle")}</h1>

      <WorkflowList onEdit={setSelected} />

      {selected && (
        <div className="rounded-lg border p-4">
          <WorkflowBuilder definition={selected} />
        </div>
      )}
    </div>
  );
}
