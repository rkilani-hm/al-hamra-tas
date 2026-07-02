import {
  LayoutDashboard, FileBarChart, Settings, Settings2, ShieldCheck, Workflow, Bell,
  ScrollText, FolderArchive, ClipboardList, KanbanSquare, UserSearch, ClipboardCheck,
  CalendarClock, FileSignature, UserCog, KeyRound, UserPlus, UserCheck, Users, Sparkles,
  Plug, Contact,
} from "lucide-react";
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
import { useAuth } from "@/features/auth/AuthProvider";
import { isSystemAdmin } from "@/features/admin/RequireAdmin";

export function AppSidebar() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Ordered by the recruitment pipeline: plan & source -> recruit -> hire,
  // then supporting tools, governance, and (system-admin only) setup/admin.
  const groups: { label: string; items: { title: string; url: string; icon: typeof LayoutDashboard }[] }[] = [
    {
      label: t("nav.group.overview"),
      items: [
        { title: t("nav.dashboard"), url: "/app", icon: LayoutDashboard },
        { title: t("nav.reports"), url: "/app/reports", icon: FileBarChart },
      ],
    },
    {
      label: t("nav.group.planSource"),
      items: [
        { title: t("nav.manpower"), url: "/app/manpower", icon: Users },
        { title: t("nav.requisitions"), url: "/app/requisitions", icon: ClipboardList },
        { title: t("nav.sourcing"), url: "/app/sourcing", icon: UserSearch },
      ],
    },
    {
      label: t("nav.group.recruit"),
      items: [
        { title: t("nav.candidates"), url: "/app/candidates", icon: Contact },
        { title: t("nav.applications"), url: "/app/applications", icon: KanbanSquare },
        { title: t("nav.screening"), url: "/app/screening", icon: ClipboardCheck },
        { title: t("nav.interviews"), url: "/app/interviews", icon: CalendarClock },
        { title: t("nav.offers"), url: "/app/offers", icon: FileSignature },
      ],
    },
    {
      label: t("nav.group.hire"),
      items: [
        { title: t("nav.preboarding"), url: "/app/preboarding", icon: UserPlus },
        { title: t("nav.onboarding"), url: "/app/onboarding", icon: UserCheck },
      ],
    },
    {
      label: t("nav.group.workspace"),
      items: [
        { title: t("nav.ai"), url: "/app/ai", icon: Sparkles },
        { title: t("nav.workflow"), url: "/app/workflow", icon: Workflow },
        { title: t("nav.notifications"), url: "/app/notifications", icon: Bell },
        { title: t("nav.documents"), url: "/app/documents", icon: FolderArchive },
      ],
    },
    {
      label: t("nav.group.governance"),
      items: [
        { title: t("nav.compliance"), url: "/app/compliance", icon: ShieldCheck },
        { title: t("nav.audit"), url: "/app/audit", icon: ScrollText },
      ],
    },
    // Setup + admin — SYSTEM_ADMIN only (routes + RPCs also enforce).
    ...(isSystemAdmin(roles)
      ? [{
          label: t("nav.group.admin"),
          items: [
            { title: t("nav.config"), url: "/app/config", icon: Settings2 },
            { title: t("nav.identity"), url: "/app/identity", icon: ShieldCheck },
            { title: t("nav.admin"), url: "/app/admin/users", icon: UserCog },
            { title: t("nav.roles"), url: "/app/admin/roles", icon: KeyRound },
            { title: t("nav.systemSettings"), url: "/app/admin/settings", icon: Settings },
            { title: t("nav.integrations"), url: "/app/admin/integrations", icon: Plug },
          ],
        }]
      : [
          // Non-admins keep access to Core Configuration + Identity (routes enforce).
          {
            label: t("nav.group.setup"),
            items: [
              { title: t("nav.config"), url: "/app/config", icon: Settings2 },
              { title: t("nav.identity"), url: "/app/identity", icon: ShieldCheck },
            ],
          },
        ]),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
