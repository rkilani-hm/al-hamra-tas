// Module M0.5 — reusable per-entity document panel.
// EXPORTED for embedding by other modules: <DocumentPanel entityType entityRef/>.
// Upload (with bilingual category), list with version badges, download, replace,
// archive. Calls the document-upload / document-download edge functions.
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Archive, Download, FileUp, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import {
  archiveDocument,
  downloadDocument,
  listCategories,
  listDocuments,
  safe,
  uploadDocument,
} from "../api";
import type { DocumentRow } from "../types";

interface DocumentPanelProps {
  entityType?: string | null;
  entityRef?: string | null;
  // The signed-in tas_user id (null until Entra sign-in is wired).
  currentUserId?: string | null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DocumentPanel({ entityType = null, entityRef = null, currentUserId = null }: DocumentPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<string>("other");
  const [replaceOf, setReplaceOf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const docsQ = useQuery({
    queryKey: ["documents", "list", entityType, entityRef],
    queryFn: safe(() => listDocuments(entityType, entityRef)),
  });
  const catsQ = useQuery({ queryKey: ["documents", "categories"], queryFn: safe(listCategories) });
  const docs = docsQ.data ?? [];
  const categories = catsQ.data ?? [];

  const catName = (code: string | null) => {
    if (!code) return "—";
    const c = categories.find((x) => x.code === code);
    return c ? (language === "ar" ? c.name_ar : c.name_en) : code;
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["documents", "list", entityType, entityRef] });

  const onPick = () => fileInput.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await doUpload(file);
    if (fileInput.current) fileInput.current.value = "";
  };

  const doUpload = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await fileToBase64(file);
      await uploadDocument({
        file_base64: dataUrl,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        title: file.name,
        category,
        linked_entity_type: entityType,
        linked_entity_ref: entityRef,
        supersedes_id: replaceOf,
        actor_user_id: currentUserId,
      });
      toast.success(t("documents.toasts.uploaded"));
      setReplaceOf(null);
      await refresh();
    } catch {
      toast.error(t("documents.toasts.uploadError"));
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (doc: DocumentRow) => {
    try {
      const { url } = await downloadDocument(doc.id, currentUserId);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("documents.toasts.downloadError"));
    }
  };

  const onArchive = async (doc: DocumentRow) => {
    try {
      await archiveDocument(doc.id);
      toast.success(t("documents.toasts.archived"));
      await refresh();
    } catch {
      toast.error(t("documents.toasts.actionError"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label className="text-xs">{t("documents.panel.category")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {language === "ar" ? c.name_ar : c.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {replaceOf && (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="h-3 w-3" /> {t("documents.panel.replacing")}
          </Badge>
        )}
        <Button className="gap-1" onClick={onPick} disabled={busy}>
          <FileUp className="h-4 w-4" /> {busy ? t("documents.panel.uploading") : t("documents.panel.upload")}
        </Button>
        <input ref={fileInput} type="file" className="hidden" onChange={onFile} />
      </div>

      {/* List */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("documents.table.title")}</TableHead>
              <TableHead className="text-start">{t("documents.table.category")}</TableHead>
              <TableHead className="text-start">{t("documents.table.version")}</TableHead>
              <TableHead className="text-start">{t("documents.table.provider")}</TableHead>
              <TableHead className="text-start">{t("documents.table.status")}</TableHead>
              <TableHead className="text-end">{t("documents.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docsQ.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                  {t("documents.table.empty")}
                </TableCell>
              </TableRow>
            ) : (
              docs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title ?? d.file_name}</TableCell>
                  <TableCell>{catName(d.category)}</TableCell>
                  <TableCell><Badge variant="outline">v{d.version}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{t(`documents.provider.${d.storage_provider}`)}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === "active" ? "default" : "outline"}>
                      {t(`documents.status.${d.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("documents.actions.download")} onClick={() => onDownload(d)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("documents.actions.replace")} onClick={() => { setReplaceOf(d.id); onPick(); }}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("documents.actions.archive")} onClick={() => onArchive(d)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
