import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Al Hamra TAS" },
      { name: "description", content: "Sign in to the Al Hamra Trade & Administration System." },
    ],
  }),
  component: LoginPage,
});

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}

function LoginPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();

  return (
    <div dir={direction} className="relative flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xl font-bold">
            A
          </div>
          <CardTitle className="text-2xl">{t("login.title")}</CardTitle>
          <CardDescription>{t("login.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-input"
            onClick={() => toast.info(t("login.notConfigured"))}
          >
            <MicrosoftLogo />
            <span>{t("login.microsoft")}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
