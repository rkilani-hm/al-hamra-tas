// Module M0.2 — Core Configuration: JD template list (status + version).
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { listJdTemplates, safe } from "../api";
import type { JdStatus, JdTemplate } from "../types";

const STATUS_VARIANT: Record<JdStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  archived: "outline",
};

interface JdTemplateListProps {
  onOpen: (template: JdTemplate) => void;
  onCreate: () => void;
}

export function JdTemplateList({ onOpen, onCreate }: JdTemplateListProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWrite = capabilities.includes("config.manage");
  const q = useQuery({ queryKey: ["config", "jdTemplates"], queryFn: safe(listJdTemplates) });
  const templates = q.data ?? [];
  const title = (tpl: JdTemplate) => (language === "ar" ? tpl.title_ar : tpl.title_en);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          {t("config.jd.title")}
        </h2>
        {canWrite && (
          <Button size="sm" className="gap-1" onClick={onCreate}>
            <Plus className="h-4 w-4" /> {t("config.jd.add")}
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("config.fields.code")}</TableHead>
              <TableHead className="text-start">{t("config.fields.title")}</TableHead>
              <TableHead className="text-start">{t("config.fields.status")}</TableHead>
              <TableHead className="text-start">{t("config.fields.version")}</TableHead>
              <TableHead className="text-end">{t("config.fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  {t("config.jd.empty")}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell><Badge variant="outline">{tpl.code}</Badge></TableCell>
                  <TableCell className="font-medium">{title(tpl)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[tpl.status]}>
                      {t(`config.jdStatus.${tpl.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">v{tpl.version}</TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="sm" onClick={() => onOpen(tpl)}>
                      {t("config.buttons.edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
