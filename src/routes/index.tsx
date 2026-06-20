import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Land in the app; the /app guard redirects to /signin (unauthenticated) or
    // /no-access (authenticated but unprovisioned).
    throw redirect({ to: "/app" });
  },
});
