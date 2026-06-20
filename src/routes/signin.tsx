// Route: /signin — Entra SAML SSO sign-in screen (bilingual, RTL-aware).
import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — Al Hamra TAS" },
      { name: "description", content: "Sign in to the Al Hamra Talent Acquisition System." },
    ],
  }),
  component: SignInPage,
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

function SignInPage() {
  const { t } = useTranslation();
  const { direction } = useLanguage();
  const { session, tasUser, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Already signed in + resolved -> go to the app.
  useEffect(() => {
    if (!loading && session && tasUser) void navigate({ to: "/app" });
  }, [loading, session, tasUser, navigate]);

  const onSignIn = async () => {
    setBusy(true);
    try {
      await signIn(); // redirects to Entra
    } catch {
      toast.error(t("auth.errors.signInFailed"));
      setBusy(false);
    }
  };

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
          <CardTitle className="text-2xl">{t("auth.signin.title")}</CardTitle>
          <CardDescription>{t("auth.signin.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full gap-2" onClick={onSignIn} disabled={busy}>
            <MicrosoftLogo />
            <span>{busy ? t("auth.signin.signingIn") : t("auth.signin.button")}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
