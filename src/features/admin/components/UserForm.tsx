// Module M0.1-admin-ui — UserForm: create or edit a tas_user. On create, the
// email MUST match the person's Entra/Microsoft sign-in email (resolve_current_user
// matches by email). Pre-provisioning is by email.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

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
import { adminErrorCode, adminUpsertUser } from "../api";
import type { AdminUser, AdminUserStatus, AppLocale } from "../types";

interface UserFormProps {
  user?: AdminUser | null;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}

export function UserForm({ user = null, onSaved, onCancel }: UserFormProps) {
  const { t } = useTranslation();
  const editing = !!user;

  const [email, setEmail] = useState(user?.email ?? "");
  const [nameEn, setNameEn] = useState(user?.display_name_en ?? "");
  const [nameAr, setNameAr] = useState(user?.display_name_ar ?? "");
  const [status, setStatus] = useState<AdminUserStatus>(user?.status ?? "active");
  const [locale, setLocale] = useState<AppLocale>(user?.default_locale ?? "en");
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!editing && !email.trim()) {
      toast.error(t("admin.errors.email_required"));
      return;
    }
    setBusy(true);
    try {
      const id = await adminUpsertUser({
        id: user?.id ?? null,
        email: email.trim() || null,
        display_name_en: nameEn.trim() || null,
        display_name_ar: nameAr.trim() || null,
        status,
        default_locale: locale,
      });
      toast.success(t("admin.toasts.userSaved"));
      onSaved(id);
    } catch (err) {
      const code = adminErrorCode(err);
      toast.error(code ? t(`admin.errors.${code}`) : t("admin.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">{t("admin.form.email")}</Label>
          <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
          <span className="text-xs text-muted-foreground">{t("admin.form.emailHint")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.form.nameEn")}</Label>
          <Input dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.form.nameAr")}</Label>
          <Input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.form.status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as AdminUserStatus)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t("admin.status.active")}</SelectItem>
              <SelectItem value="inactive">{t("admin.status.inactive")}</SelectItem>
              <SelectItem value="unprovisioned">{t("admin.status.unprovisioned")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("admin.form.locale")}</Label>
          <Select value={locale} onValueChange={(v) => setLocale(v as AppLocale)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("admin.locale.en")}</SelectItem>
              <SelectItem value="ar">{t("admin.locale.ar")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={busy}>
          {busy ? t("admin.actions.saving") : t("admin.actions.save")}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>{t("admin.actions.cancel")}</Button>
        )}
      </div>
    </div>
  );
}
