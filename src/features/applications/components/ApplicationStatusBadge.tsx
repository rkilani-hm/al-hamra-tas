// Module M1.5 — bilingual application status badge.
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "../types";

const VARIANT: Record<ApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  hired: "default",
  rejected: "destructive",
  withdrawn: "outline",
  on_hold: "outline",
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[status]}>{t(`applications.status.${status}`)}</Badge>;
}
