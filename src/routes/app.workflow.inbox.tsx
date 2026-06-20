// Route: /app/workflow/inbox — My Approvals.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ApprovalInbox } from "@/features/workflow/components/ApprovalInbox";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/workflow/inbox")({
  head: () => ({ meta: [{ title: "My Approvals — Al Hamra TAS" }] }),
  component: InboxPage,
});

function InboxPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  const { currentUserId } = useAuth();

  return (
    <div className="space-y-4">
      <Link to="/app/workflow" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" />
        {t("workflow.backToWorkflow")}
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{t("workflow.inbox.pageTitle")}</h1>
      <ApprovalInbox currentUserId={currentUserId} />
    </div>
  );
}
