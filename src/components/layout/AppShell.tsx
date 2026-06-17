import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useLanguage } from "@/hooks/use-language";

export function AppShell({ children }: { children: ReactNode }) {
  const { direction } = useLanguage();

  return (
    <SidebarProvider>
      <div dir={direction} className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
