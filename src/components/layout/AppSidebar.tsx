import {
  LayoutDashboard, FileBarChart, Settings, Settings2, ShieldCheck, Workflow, Bell,
  ScrollText, FolderArchive, ClipboardList, KanbanSquare, UserSearch, ClipboardCheck,
  CalendarClock, FileSignature, UserCog, KeyRound, UserPlus, UserCheck, Users, Sparkles,
  Plug, Contact, Plus, Minus, FileCheck2,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/features/auth/AuthProvider";
import { isSystemAdmin } from "@/features/admin/RequireAdmin";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; defaultOpen: boolean; items: NavItem[] };

export function AppSidebar() {
  const { t } = useTranslation();
  const { roles, capabilities } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Ordered by the recruitment pipeline: plan & source -> recruit -> hire,
  // then supporting tools, governance, and (system-admin only) setup/admin.
  // Supporting groups start collapsed to keep the pipeline uncluttered.
  const groups: NavGroup[] = [
    {
      label: t("nav.group.overview"),
      defaultOpen: true,
      items: [
        { title: t("nav.dashboard"), url: "/app", icon: LayoutDashboard },
        { title: t("nav.reports"), url: "/app/reports", icon: FileBarChart },
      ],
    },
    {
      label: t("nav.group.planSource"),
      defaultOpen: true,
      items: [
        { title: t("nav.manpower"), url: "/app/manpower", icon: Users },
        { title: t("nav.requisitions"), url: "/app/requisitions", icon: ClipboardList },
        { title: t("nav.sourcing"), url: "/app/sourcing", icon: UserSearch },
      ],
    },
    {
      label: t("nav.group.recruit"),
      defaultOpen: true,
      items: [
        { title: t("nav.candidates"), url: "/app/candidates", icon: Contact },
        { title: t("nav.applications"), url: "/app/applications", icon: KanbanSquare },
        { title: t("nav.screening"), url: "/app/screening", icon: ClipboardCheck },
        { title: t("nav.interviews"), url: "/app/interviews", icon: CalendarClock },
        // Assessment (M1.8) — shown only to users who can work with assessments.
        ...(capabilities.includes("assessment.write")
          ? [{ title: t("nav.assessments"), url: "/app/assessments", icon: FileCheck2 }]
          : []),
        { title: t("nav.offers"), url: "/app/offers", icon: FileSignature },
      ],
    },
    {
      label: t("nav.group.hire"),
      defaultOpen: true,
      items: [
        { title: t("nav.preboarding"), url: "/app/preboarding", icon: UserPlus },
        { title: t("nav.onboarding"), url: "/app/onboarding", icon: UserCheck },
      ],
    },
    {
      label: t("nav.group.workspace"),
      defaultOpen: false,
      items: [
        { title: t("nav.ai"), url: "/app/ai", icon: Sparkles },
        { title: t("nav.workflow"), url: "/app/workflow", icon: Workflow },
        { title: t("nav.notifications"), url: "/app/notifications", icon: Bell },
        { title: t("nav.documents"), url: "/app/documents", icon: FolderArchive },
      ],
    },
    {
      label: t("nav.group.governance"),
      defaultOpen: false,
      items: [
        { title: t("nav.compliance"), url: "/app/compliance", icon: ShieldCheck },
        { title: t("nav.audit"), url: "/app/audit", icon: ScrollText },
      ],
    },
    // Setup + admin — SYSTEM_ADMIN only (routes + RPCs also enforce).
    ...(isSystemAdmin(roles)
      ? [{
          label: t("nav.group.admin"),
          defaultOpen: false,
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
            defaultOpen: false,
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
        {groups.map((group) => {
          // Force the group open when it contains the current route.
          const hasActive = group.items.some((i) => i.url === pathname);
          return (
            <Collapsible
              key={group.label}
              defaultOpen={group.defaultOpen || hasActive}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center rounded-md px-2 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                    <span>{group.label}</span>
                    <Plus className="ml-auto h-3.5 w-3.5 shrink-0 transition-opacity group-data-[state=open]/collapsible:hidden" />
                    <Minus className="ml-auto hidden h-3.5 w-3.5 shrink-0 transition-opacity group-data-[state=open]/collapsible:block" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
