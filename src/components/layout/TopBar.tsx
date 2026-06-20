import { User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useAuth } from "@/features/auth/AuthProvider";
import { useLanguage } from "@/hooks/use-language";

export function TopBar() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentUserId, tasUser, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    (language === "ar" ? tasUser?.display_name_ar : tasUser?.display_name_en) ||
    tasUser?.display_name_en ||
    tasUser?.email ||
    "";

  const onSignOut = async () => {
    await signOut();
    void navigate({ to: "/signin" });
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger aria-label={t("topbar.toggleSidebar")} />
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold"
        >
          A
        </div>
        <span className="font-semibold tracking-tight text-foreground">
          {t("app.name")}
        </span>
      </div>

      <div className="ms-auto flex items-center gap-1">
        <NotificationBell currentUserId={currentUserId} />
        <LanguageToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("topbar.userMenu")}>
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-xs text-muted-foreground">{t("auth.signedInAs")}</span>
              <span className="block truncate text-sm font-medium text-foreground">{displayName || "—"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>{t("topbar.profile")}</DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut}>{t("topbar.signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
