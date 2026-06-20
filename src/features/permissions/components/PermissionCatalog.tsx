// Module M3.1-step2a — PermissionCatalog: read-only catalog grouped by area.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { permListCatalog, safe } from "../api";
import type { CatalogPermission } from "../types";

export function PermissionCatalog() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const q = useQuery({ queryKey: ["permissions", "catalog"], queryFn: safe(permListCatalog) });
  const perms = q.data ?? [];

  const byArea = useMemo(() => {
    const m = new Map<string, CatalogPermission[]>();
    for (const p of perms) {
      const arr = m.get(p.area) ?? [];
      arr.push(p);
      m.set(p.area, arr);
    }
    return [...m.entries()];
  }, [perms]);

  const name = (p: CatalogPermission) => (language === "ar" ? p.name_ar : p.name_en);
  const desc = (p: CatalogPermission) => (language === "ar" ? p.description_ar : p.description_en);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">{t("permissions.common.loading")}</p>;
  if (perms.length === 0) {
    return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{t("permissions.catalog.empty")}</p>;
  }

  return (
    <div className="space-y-5">
      {byArea.map(([area, list]) => (
        <section key={area} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`permissions.area.${area}`)}
          </h3>
          <ul className="divide-y rounded-md border">
            {list.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {name(p)}
                    {p.is_system && <Badge variant="secondary" className="text-xs">{t("permissions.catalog.system")}</Badge>}
                  </span>
                  {desc(p) && <span className="text-xs text-muted-foreground">{desc(p)}</span>}
                </div>
                <Badge variant="outline" dir="ltr" className="font-mono text-xs">{p.key}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
