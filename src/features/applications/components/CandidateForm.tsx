// Module M1.5 — create/edit candidate. Bilingual, RTL.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { listLookups, safe as configSafe } from "@/features/config/api";
import { upsertCandidate } from "../api";
import type { Candidate } from "../types";

interface CandidateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Candidate | null;
  onSaved?: (id: string) => void;
}

export function CandidateForm({ open, onOpenChange, initial = null, onSaved }: CandidateFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWriteCand = capabilities.includes("candidate.write");

  const natClassQ = useQuery({ queryKey: ["applications", "lk", "nationality_class"], queryFn: configSafe(() => listLookups("nationality_class")) });
  const natClasses = natClassQ.data ?? [];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [natClass, setNatClass] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(initial?.first_name ?? "");
    setLastName(initial?.last_name ?? "");
    setNameEn(initial?.full_name_en ?? "");
    setNameAr(initial?.full_name_ar ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setNationality(initial?.nationality ?? "");
    setNatClass(initial?.nationality_class ?? "");
    setCurrentTitle(initial?.current_title ?? "");
    setSource(initial?.source ?? "");
  }, [open, initial]);

  const lkName = (o: { name_en: string; name_ar: string }) => (language === "ar" ? o.name_ar : o.name_en);
  const canSave = (nameEn.trim() || (firstName.trim() && lastName.trim())) && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = await upsertCandidate({
        id: initial?.id ?? null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name_en: nameEn.trim() || `${firstName} ${lastName}`.trim() || null,
        full_name_ar: nameAr.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        nationality: nationality.trim() || null,
        nationality_class: natClass || null,
        current_title: currentTitle.trim() || null,
        source: source.trim() || null,
      });
      toast.success(t("applications.candidate.saved"));
      onOpenChange(false);
      onSaved?.(id);
    } catch {
      toast.error(t("applications.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? t("applications.candidate.editTitle") : t("applications.candidate.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.firstName")}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.lastName")}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.fullNameEn")}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.fullNameAr")}</Label>
              <Input dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.email")}</Label>
              <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.phone")}</Label>
              <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.nationality")}</Label>
              <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.nationalityClass")}</Label>
              <Select value={natClass || undefined} onValueChange={setNatClass}>
                <SelectTrigger><SelectValue placeholder={t("applications.common.select")} /></SelectTrigger>
                <SelectContent>{natClasses.map((l) => <SelectItem key={l.code} value={l.code}>{lkName(l)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.currentTitle")}</Label>
              <Input value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("applications.candidate.source")}</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t("applications.actions.cancel")}</Button>
          <Button onClick={submit} disabled={!canSave || !canWriteCand}>{t("applications.actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
