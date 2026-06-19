import { LayoutDashboard, FileBarChart, Settings, Settings2, ShieldCheck, Workflow, Bell, ScrollText, FolderArchive, ClipboardList, KanbanSquare, UserSearch, ClipboardCheck, CalendarClock } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { title: t("nav.dashboard"), url: "/app", icon: LayoutDashboard },
    { title: t("nav.identity"), url: "/app/identity", icon: ShieldCheck },
    { title: t("nav.config"), url: "/app/config", icon: Settings2 },
    { title: t("nav.requisitions"), url: "/app/requisitions", icon: ClipboardList },
    { title: t("nav.applications"), url: "/app/applications", icon: KanbanSquare },
    { title: t("nav.candidates"), url: "/app/candidates", icon: UserSearch },
    { title: t("nav.screening"), url: "/app/screening", icon: ClipboardCheck },
    { title: t("nav.interviews"), url: "/app/interviews", icon: CalendarClock },
    { title: t("nav.workflow"), url: "/app/workflow", icon: Workflow },
    { title: t("nav.notifications"), url: "/app/notifications", icon: Bell },
    { title: t("nav.documents"), url: "/app/documents", icon: FolderArchive },
    { title: t("nav.audit"), url: "/app/audit", icon: ScrollText },
    { title: t("nav.reports"), url: "/app", icon: FileBarChart },
    { title: t("nav.settings"), url: "/app", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("app.name")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
