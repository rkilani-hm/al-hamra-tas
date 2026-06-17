// Module M0.2 — Core Configuration: generic lookup manager.
// Pick a lookup_type, manage its bilingual values. RTL-safe.

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createLookup,
  deleteLookup,
  listLookups,
  safe,
  updateLookup,
} from "../api";
import { LOOKUP_TYPES, type Lookup } from "../types";

export function LookupManager() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const qc = useQueryClient();

  const [lookupType, setLookupType] = useState<string>(LOOKUP_TYPES[0]);

  const q = useQuery({
    queryKey: ["config", "lookups", lookupType],
    queryFn: safe(() => listLookups(lookupType)),
  });
  const rows = q.data ?? [];
  const name = (l: Lookup) => (language === "ar" ? l.name_ar : l.name_en);

  // Form state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lookup | null>(null);
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setNameEn(editing?.name_en ?? "");
    setNameAr(editing?.name_ar ?? "");
    setSortOrder(editing ? String(editing.sort_order) : "");
  }, [open, editing]);

  const canSave = code.trim() && nameEn.trim() && nameAr.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const v = {
        lookup_type: lookupType,
        code: code.trim(),
        name_en: nameEn.trim(),
        name_ar: nameAr.trim(),
        sort_order: sortOrder.trim() ? Number(sortOrder) : 0,
        status: editing?.status ?? "active",
      };
      if (editing) await updateLookup(editing.id, v);
      else await createLookup(v);
      toast.success(t("config.toasts.saved"));
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["config", "lookups", lookupType] });
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (l: Lookup) => {
    try {
      await deleteLookup(l.id);
      toast.success(t("config.toasts.deleted"));
      await qc.invalidateQueries({ queryKey: ["config", "lookups", lookupType] });
    } catch {
      toast.error(t("config.toasts.deleteError"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2 sm:w-64">
          <Label>{t("config.lookups.type")}</Label>
          <Select value={lookupType} onValueChange={setLookupType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOOKUP_TYPES.map((lt) => (
                <SelectItem key={lt} value={lt}>
                  {t(`config.lookupType.${lt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="gap-1"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t("config.lookups.add")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("config.fields.code")}</TableHead>
              <TableHead className="text-start">{t("config.fields.nameEn")}</TableHead>
              <TableHead className="text-start">{t("config.fields.nameAr")}</TableHead>
              <TableHead className="text-start">{t("config.fields.sortOrder")}</TableHead>
              <TableHead className="text-end">{t("config.fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  {t("config.lookups.empty")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="outline">{l.code}</Badge></TableCell>
                  <TableCell className="font-medium">{l.name_en}</TableCell>
                  <TableCell dir="rtl">{l.name_ar}</TableCell>
                  <TableCell className="text-muted-foreground">{l.sort_order}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("config.buttons.edit")}
                        onClick={() => {
                          setEditing(l);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label={t("config.buttons.delete")}
                        onClick={() => remove(l)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("config.lookups.editTitle") : t("config.lookups.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lk-code">{t("config.fields.code")}</Label>
                <Input id="lk-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lk-sort">{t("config.fields.sortOrder")}</Label>
                <Input id="lk-sort" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="lk-en">{t("config.fields.nameEn")}</Label>
                <Input id="lk-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lk-ar">{t("config.fields.nameAr")}</Label>
                <Input id="lk-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("config.buttons.cancel")}
            </Button>
            <Button onClick={submit} disabled={!canSave}>
              {t("config.buttons.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
