// Module M0.2 — Core Configuration: create/edit a Department (bilingual).
// Supports an optional parent department (sub-departments / sections).
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import type { Department } from "../types";

export interface DepartmentFormValues {
  branch_id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: string;
  parent_department_id: string | null;
  function_code: string | null;
}

interface DepartmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  // Candidate parents (other departments in the same branch).
  parentOptions: Department[];
  initial?: Department | null;
  onSubmit: (values: DepartmentFormValues) => void;
  saving?: boolean;
}

const NO_PARENT = "__none__";

export function DepartmentForm({
  open,
  onOpenChange,
  branchId,
  parentOptions,
  initial,
  onSubmit,
  saving,
}: DepartmentFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [code, setCode] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  const [fnCode, setFnCode] = useState("");

  useEffect(() => {
    if (open) {
      setCode(initial?.code ?? "");
      setNameEn(initial?.name_en ?? "");
      setNameAr(initial?.name_ar ?? "");
      setParentId(initial?.parent_department_id ?? NO_PARENT);
      setFnCode(initial?.function_code ?? "");
    }
  }, [open, initial]);

  const canSave = code.trim() && nameEn.trim() && nameAr.trim() && !saving;
  const depName = (d: Department) => (language === "ar" ? d.name_ar : d.name_en);

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      branch_id: initial?.branch_id ?? branchId,
      code: code.trim(),
      name_en: nameEn.trim(),
      name_ar: nameAr.trim(),
      status: initial?.status ?? "active",
      parent_department_id: parentId === NO_PARENT ? null : parentId,
      function_code: fnCode.trim() || null,
    });
  };

  // Avoid offering the department itself as its own parent.
  const parents = parentOptions.filter((p) => p.id !== initial?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("config.department.editTitle") : t("config.department.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("config.department.formHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dp-code">{t("config.fields.code")}</Label>
            <Input id="dp-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dp-en">{t("config.fields.nameEn")}</Label>
              <Input id="dp-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dp-ar">{t("config.fields.nameAr")}</Label>
              <Input id="dp-ar" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>{t("config.fields.parentDepartment")}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>
                    {t("config.department.noParent")}
                  </SelectItem>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {depName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dp-fn">{t("config.fields.functionCode")}</Label>
              <Input id="dp-fn" value={fnCode} onChange={(e) => setFnCode(e.target.value)} />
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
