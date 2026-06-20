import { Outlet, createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/features/auth/RequireAuth";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Al Hamra TAS" },
      { name: "description", content: "Al Hamra Trade & Administration System." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  ),
});
