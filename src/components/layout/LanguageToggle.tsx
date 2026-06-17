import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

export function LanguageToggle() {
  const { toggle } = useLanguage();
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="gap-2"
      aria-label={t("topbar.language")}
    >
      <Languages className="h-4 w-4" />
      <span>{t("topbar.language")}</span>
    </Button>
  );
}
