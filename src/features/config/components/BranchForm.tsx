// Module M0.2 — Core Configuration: create/edit a Branch (bilingual).
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
import type { Branch } from "../types";

export interface BranchFormValues {
  entity_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  address_en: string | null;
  address_ar: string | null;
  paci_area: string | null;
}

interface BranchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  initial?: Branch | null;
  onSubmit: (values: BranchFormValues) => void;
  saving?: boolean;
}

export function BranchForm({
  open,
  onOpenChange,
  entityId,
  initial,
  onSubmit,
  saving,
}: BranchFormProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [addrEn, setAddrEn] = useState("");
  const [addrAr, setAddrAr] = useState("");
  const [paci, setPaci] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? "");
      setNameEn(initial?.name_en ?? "");
      setNameAr(initial?.name_ar ?? "");
      setAddrEn(initial?.address_en ?? "");
      setAddrAr(initial?.address_ar ?? "");
      setPaci(initial?.paci_area ?? "");
    }
  }, [open, initial]);

  const canSave = code.trim() && nameEn.trim() && nameAr.trim() && !saving;

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      entity_id: initial?.entity_id ?? entityId,
      code: code.trim(),
      name_en: nameEn.trim(),
      name_ar: nameAr.trim(),
      status: initial?.status ?? "active",
      address_en: addrEn.trim() || null,
      address_ar: addrAr.trim() || null,
      paci_area: paci.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("config.branch.editTitle") : t("config.branch.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("config.branch.formHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="br-code">{t("config.fields.code")}</Label>
            <Input id="br-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-en">{t("config.fields.nameEn")}</Label>
              <Input id="br-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-ar">{t("config.fields.nameAr")}</Label>
              <Input id="br-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-aen">{t("config.fields.addressEn")}</Label>
              <Input id="br-aen" value={addrEn} onChange={(e) => setAddrEn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="br-aar">{t("config.fields.addressAr")}</Label>
              <Input id="br-aar" dir="rtl" value={addrAr} onChange={(e) => setAddrAr(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="br-paci">{t("config.fields.paciArea")}</Label>
            <Input id="br-paci" value={paci} onChange={(e) => setPaci(e.target.value)} />
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
