// Module M3.1-step2a — RoleForm: create or edit a role. Code is immutable on edit;
// is_system is never settable via the UI.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { permissionErrorCode, roleUpsert } from "../api";
import type { MatrixRole } from "../types";

interface RoleFormProps {
  role?: MatrixRole | null;
  onSaved: () => void;
  onCancel?: () => void;
}

export function RoleForm({ role = null, onSaved, onCancel }: RoleFormProps) {
  const { t } = useTranslation();
  const editing = !!role;

  const [code, setCode] = useState(role?.code ?? "");
  const [nameEn, setNameEn] = useState(role?.name_en ?? "");
  const [nameAr, setNameAr] = useState(role?.name_ar ?? "");
  const [descEn, setDescEn] = useState(role?.description_en ?? "");
  const [descAr, setDescAr] = useState(role?.description_ar ?? "");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!editing && !code.trim()) {
      toast.error(t("permissions.errors.role_code_required"));
      return;
    }
    setBusy(true);
    try {
      await roleUpsert({
        id: role?.id ?? null,
        code: editing ? undefined : code.trim(),
        name_en: nameEn.trim() || null,
        name_ar: nameAr.trim() || null,
        description_en: descEn.trim() || null,
        description_ar: descAr.trim() || null,
      });
      toast.success(t("permissions.toasts.roleSaved"));
      onSaved();
    } catch (err) {
      const c = permissionErrorCode(err);
      toast.error(c ? t(`permissions.errors.${c}`) : t("permissions.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("permissions.role.code")}</Label>
          <Input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} disabled={editing} className="h-9 font-mono" />
          {editing && <span className="text-xs text-muted-foreground">{t("permissions.role.codeImmutable")}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("permissions.role.nameEn")}</Label>
          <Input dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("permissions.role.nameAr")}</Label>
          <Input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("permissions.role.descEn")}</Label>
          <Textarea dir="ltr" rows={2} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("permissions.role.descAr")}</Label>
          <Textarea dir="rtl" rows={2} value={descAr} onChange={(e) => setDescAr(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={busy}>{busy ? t("permissions.actions.saving") : t("permissions.actions.save")}</Button>
        {onCancel && <Button variant="outline" onClick={onCancel} disabled={busy}>{t("permissions.actions.cancel")}</Button>}
      </div>
    </div>
  );
}
