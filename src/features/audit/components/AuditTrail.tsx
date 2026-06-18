// Module M0.5 — reusable per-entity audit timeline.
// EXPORTED for embedding by other modules: <AuditTrail entityType entityRef/>.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { searchAudit, safe } from "../api";

interface AuditTrailProps {
  entityType: string;
  entityRef: string;
  limit?: number;
}

export function AuditTrail({ entityType, entityRef, limit = 50 }: AuditTrailProps) {
  const { t } = useTranslation();

  const q = useQuery({
    queryKey: ["audit", "trail", entityType, entityRef, limit],
    queryFn: safe(() => searchAudit({ entityType, entityRef, limit })),
  });
  const entries = q.data ?? [];

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("audit.common.loading")}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        {t("audit.trail.empty")}
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {entries.map((e) => (
        <li key={`${e.source}-${e.id}`} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-muted">
              <History className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="mt-1 w-px flex-1 bg-border" />
          </div>
          <div className="flex-1 space-y-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{e.event_type}</span>
              {e.module_code && <Badge variant="outline">{e.module_code}</Badge>}
              <span className="text-xs text-muted-foreground" dir="ltr">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
            {e.detail_json && Object.keys(e.detail_json).length > 0 && (
              <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground" dir="ltr">
                {JSON.stringify(e.detail_json, null, 2)}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
