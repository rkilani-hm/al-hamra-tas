// Route: /no-access — shown when a session exists but resolve_current_user()
// returns nothing (the user is authenticated by Entra but has no active tas_user).
// PRE-PROVISIONED model: access is granted by an administrator, not auto-created.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/no-access")({
  head: () => ({ meta: [{ title: "No access — Al Hamra TAS" }] }),
  component: NoAccessPage,
});

function NoAccessPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { session, tasUser, signOut } = useAuth();
  const navigate = useNavigate();

  // Provisioned in the meantime (or never signed in) -> route appropriately.
  if (session && tasUser) {
    void navigate({ to: "/app" });
  }

  const onSignOut = async () => {
    await signOut();
    void navigate({ to: "/signin" });
  };

  return (
    <div dir={direction} className="relative flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl">{t("auth.noAccess.title")}</CardTitle>
          <CardDescription>{t("auth.noAccess.message")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">{t("auth.noAccess.contact")}</p>
          <Button variant="outline" className="w-full" onClick={onSignOut}>
            {t("auth.signOut")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
