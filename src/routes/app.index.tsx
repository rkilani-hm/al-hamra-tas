import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-foreground">{t("shell.welcome")}</h1>
      <p className="text-muted-foreground">{t("shell.placeholder")}</p>
    </div>
  );
}
