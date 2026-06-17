// Module M0.2 — small back link to the Core Configuration landing. RTL-safe
// (chevron picks direction from the active document dir).
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

export function ConfigBackLink() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;
  return (
    <Link
      to="/app/config"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <Chevron className="h-4 w-4" />
      {t("config.backToConfig")}
    </Link>
  );
}
