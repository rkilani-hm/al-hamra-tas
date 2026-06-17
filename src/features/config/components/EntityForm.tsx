// Module M0.2 — Core Configuration: create/edit an Entity (bilingual).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Entity } from "../types";

export interface EntityFormValues {
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  commercial_reg_no: string | null;
  kuwaitization_target_pct: number | null;
}

interface EntityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Entity | null;
  onSubmit: (values: EntityFormValues) => void;
  saving?: boolean;
}

export function EntityForm({
  open,
  onOpenChange,
  initial,
  onSubmit,
  saving,
}: EntityFormProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [crNo, setCrNo] = useState("");
  const [kpct, setKpct] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? "");
      setNameEn(initial?.name_en ?? "");
      setNameAr(initial?.name_ar ?? "");
      setCrNo(initial?.commercial_reg_no ?? "");
      setKpct(
        initial?.kuwaitization_target_pct != null
          ? String(initial.kuwaitization_target_pct)
          : "",
      );
    }
  }, [open, initial]);

  const canSave = code.trim() && nameEn.trim() && nameAr.trim() && !saving;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      code: code.trim(),
      name_en: nameEn.trim(),
      name_ar: nameAr.trim(),
      status: initial?.status ?? "active",
      commercial_reg_no: crNo.trim() || null,
      kuwaitization_target_pct: kpct.trim() ? Number(kpct) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("config.entity.editTitle") : t("config.entity.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("config.entity.formHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ent-code">{t("config.fields.code")}</Label>
            <Input id="ent-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-en">{t("config.fields.nameEn")}</Label>
              <Input id="ent-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-ar">{t("config.fields.nameAr")}</Label>
              <Input id="ent-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-cr">{t("config.fields.commercialRegNo")}</Label>
              <Input id="ent-cr" value={crNo} onChange={(e) => setCrNo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ent-kpct">{t("config.fields.kuwaitizationTarget")}</Label>
              <Input
                id="ent-kpct"
                type="number"
                min={0}
                max={100}
                value={kpct}
                onChange={(e) => setKpct(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("config.buttons.cancel")}
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {t("config.buttons.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
