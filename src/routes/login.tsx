import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy alias: the real sign-in lives at /signin (Entra SAML SSO).
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/signin" });
  },
});
