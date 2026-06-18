// Module M0.3 — reusable bilingual workflow status badge.
// EXPORTED for reuse by request modules (M1.2 / M1.9 …).
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { InstanceStatus } from "../types";

const VARIANT: Record<
  InstanceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  in_progress: "secondary",
  approved: "default",
  rejected: "destructive",
  returned: "outline",
  blocked: "destructive",
};

export function WorkflowStatusBadge({ status }: { status: InstanceStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[status]}>{t(`workflow.status.${status}`)}</Badge>;
}
