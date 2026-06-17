// Module M0.1 — Identity & Access: users list.
// Locale-aware name, email, status badge, roles, scope summary, row actions.
// RTL-safe: uses logical spacing (gap, ms-/me-) and inherits dir from AppShell.

import { useTranslation } from "react-i18next";
import { MoreHorizontal, ShieldCheck, MapPin, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import type { UserStatus, UserWithAccess } from "../types";

interface UserTableProps {
  users: UserWithAccess[];
  loading?: boolean;
  onAssignRoles?: (user: UserWithAccess) => void;
  onEditScope?: (user: UserWithAccess) => void;
  onDelegate?: (user: UserWithAccess) => void;
}

const STATUS_VARIANT: Record<
  UserStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  unprovisioned: "secondary",
  inactive: "destructive",
};

export function UserTable({
  users,
  loading,
  onAssignRoles,
  onEditScope,
  onDelegate,
}: UserTableProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const displayName = (u: UserWithAccess) => {
    const localized = language === "ar" ? u.display_name_ar : u.display_name_en;
    return localized || u.display_name_en || u.display_name_ar || u.email;
  };

  const roleLabel = (u: UserWithAccess) =>
    language === "ar"
      ? u.roles.map((r) => r.name_ar)
      : u.roles.map((r) => r.name_en);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">{t("identity.table.name")}</TableHead>
            <TableHead className="text-start">{t("identity.table.email")}</TableHead>
            <TableHead className="text-start">{t("identity.table.status")}</TableHead>
            <TableHead className="text-start">{t("identity.table.roles")}</TableHead>
            <TableHead className="text-start">{t("identity.table.scope")}</TableHead>
            <TableHead className="text-end">{t("identity.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {t("identity.table.loading")}
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {t("identity.table.empty")}
              </TableCell>
            </TableRow>
          ) : (
            users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-foreground">
                  {displayName(u)}
                </TableCell>
                <TableCell className="text-muted-foreground" dir="ltr">
                  {u.email}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[u.status]}>
                    {t(`identity.status.${u.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {roleLabel(u).length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t("identity.table.noRoles")}
                      </span>
                    ) : (
                      roleLabel(u).map((name, i) => (
                        <Badge key={i} variant="outline">
                          {name}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {u.scope.length === 0
                    ? t("identity.table.noScope")
                    : `${u.scope.length} ${t("identity.table.scopeUnit")}`}
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("identity.table.actions")}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onAssignRoles?.(u)}>
                        <ShieldCheck className="me-2 h-4 w-4" />
                        {t("identity.actions.assignRoles")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditScope?.(u)}>
                        <MapPin className="me-2 h-4 w-4" />
                        {t("identity.actions.editScope")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelegate?.(u)}>
                        <UserCog className="me-2 h-4 w-4" />
                        {t("identity.actions.delegate")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
