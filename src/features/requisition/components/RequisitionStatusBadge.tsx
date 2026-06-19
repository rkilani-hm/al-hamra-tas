// Module M1.2 — bilingual requisition LIFECYCLE status badge.
// (Distinct from the reused M0.3 <WorkflowStatusBadge>, which renders the linked
// workflow INSTANCE status — requisition has its own status enum.)
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { RequisitionStatus } from "../types";

const VARIANT: Record<
  RequisitionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  submitted: "secondary",
  in_approval: "secondary",
  approved: "default",
  published: "default",
  on_hold: "outline",
  cancelled: "destructive",
  closed: "outline",
};

export function RequisitionStatusBadge({ status }: { status: RequisitionStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[status]}>{t(`requisition.status.${status}`)}</Badge>;
}
