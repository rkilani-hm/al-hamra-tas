// Route: /app/config/jd — JD templates (list + editor).
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { JdTemplateList } from "@/features/config/components/JdTemplateList";
import { JdTemplateEditor } from "@/features/config/components/JdTemplateEditor";
import { ConfigBackLink } from "@/features/config/components/ConfigBackLink";
import type { JdTemplate } from "@/features/config/types";

export const Route = createFileRoute("/app/config/jd")({
  head: () => ({ meta: [{ title: "JD Templates — Al Hamra TAS" }] }),
  component: JdPage,
});

function JdPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JdTemplate | null>(null);

  return (
    <div className="space-y-4">
      <ConfigBackLink />
      <h1 className="text-2xl font-semibold text-foreground">{t("config.jd.pageTitle")}</h1>
      <JdTemplateList
        onCreate={() => {
          setEditing(null);
          setOpen(true);
        }}
        onOpen={(tpl) => {
          setEditing(tpl);
          setOpen(true);
        }}
      />
      <JdTemplateEditor
        open={open}
        onOpenChange={setOpen}
        template={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["config", "jdTemplates"] })}
      />
    </div>
  );
}
