// Module M0.1-admin-ui — UserList: searchable/filterable list of tas_user with
// roles + scope count. Admin-only (the route guard + RPC enforce SYSTEM_ADMIN).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { adminListUsers, safe } from "../api";
import type { AdminRoleRef } from "../types";

const ALL = "all";

export function UserList() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);

  const q = useQuery({
    queryKey: ["admin", "users", search, status],
    queryFn: safe(() => adminListUsers({ search: search || null, status: status === ALL ? null : status })),
  });
  const users = q.data ?? [];

  const userName = (u: { display_name_en: string | null; display_name_ar: string | null; email: string }) =>
    (language === "ar" ? u.display_name_ar : u.display_name_en) || u.display_name_en || u.email;
  const roleName = (r: AdminRoleRef) => (language === "ar" ? r.name_ar : r.name_en);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder={t("admin.list.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("admin.list.allStatuses")}</SelectItem>
              <SelectItem value="active">{t("admin.status.active")}</SelectItem>
              <SelectItem value="inactive">{t("admin.status.inactive")}</SelectItem>
              <SelectItem value="unprovisioned">{t("admin.status.unprovisioned")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm" className="gap-1">
          <Link to="/app/admin/users/new"><UserPlus className="h-4 w-4" /> {t("admin.actions.newUser")}</Link>
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.common.loading")}</p>
      ) : users.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("admin.list.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 px-3 text-start font-medium">{t("admin.form.name")}</th>
                <th className="py-2 px-3 text-start font-medium">{t("admin.form.email")}</th>
                <th className="py-2 px-3 text-start font-medium">{t("admin.form.status")}</th>
                <th className="py-2 px-3 text-start font-medium">{t("admin.list.roles")}</th>
                <th className="py-2 px-3 text-start font-medium">{t("admin.list.scopes")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-3">
                    <Link to="/app/admin/users/$id" params={{ id: u.id }} className="font-medium text-primary hover:underline">
                      {userName(u)}
                    </Link>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground" dir="ltr">{u.email}</td>
                  <td className="py-2 px-3"><Badge variant={u.status === "active" ? "default" : "secondary"}>{t(`admin.status.${u.status}`)}</Badge></td>
                  <td className="py-2 px-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? <span className="text-xs text-muted-foreground">—</span> :
                        u.roles.map((r) => <Badge key={r.id} variant="outline" className="text-xs">{roleName(r)}</Badge>)}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground" dir="ltr">{u.scope_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
