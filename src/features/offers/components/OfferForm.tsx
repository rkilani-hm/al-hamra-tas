// Module M1.9 — OfferForm: create or edit a draft offer. Grade (M0.2), salary +
// currency (KWD), employment/contract type (tas_lookup), start date, probation,
// bilingual terms, expiry. Save draft / Submit (submit_offer). Draft-field writes
// are service-role until M3.1 (edit fails-soft, mirrors M1.2).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  createDraftOffer,
  listJobGrades,
  listLookup,
  safe,
  submitOffer,
  updateDraftOffer,
} from "../api";
import type { OfferRecord } from "../types";

interface OfferFormProps {
  applicationId: string;
  candidateId: string;
  offer?: OfferRecord | null;
  currentUserId?: string | null;
  onSaved: (offerId: string) => void;
  onCancel?: () => void;
}

export function OfferForm({ applicationId, candidateId, offer = null, currentUserId = null, onSaved, onCancel }: OfferFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canWriteOffer = capabilities.includes("offer.write");
  const canSubmitOffer = capabilities.includes("offer.submit");
  const editing = !!offer;

  const gradesQ = useQuery({ queryKey: ["offers", "grades"], queryFn: safe(listJobGrades) });
  const empTypesQ = useQuery({ queryKey: ["lookup", "employment_type"], queryFn: safe(() => listLookup("employment_type")) });
  const contractTypesQ = useQuery({ queryKey: ["lookup", "contract_type"], queryFn: safe(() => listLookup("contract_type")) });

  const [jobGradeId, setJobGradeId] = useState<string | undefined>(offer?.job_grade_id ?? undefined);
  const [salary, setSalary] = useState(offer?.salary_amount != null ? String(offer.salary_amount) : "");
  const [employmentType, setEmploymentType] = useState<string | undefined>(offer?.employment_type ?? undefined);
  const [contractType, setContractType] = useState<string | undefined>(offer?.contract_type ?? undefined);
  const [startDate, setStartDate] = useState(offer?.start_date ?? "");
  const [probation, setProbation] = useState(offer?.probation_months != null ? String(offer.probation_months) : "");
  const [termsEn, setTermsEn] = useState(offer?.terms_en ?? "");
  const [termsAr, setTermsAr] = useState(offer?.terms_ar ?? "");
  const [expiry, setExpiry] = useState(offer?.expiry_date ?? "");
  const [busy, setBusy] = useState(false);

  const localized = (o: { name_en: string; name_ar: string }) => (language === "ar" ? o.name_ar : o.name_en);

  const buildPatch = () => ({
    application_id: applicationId,
    candidate_id: candidateId,
    job_grade_id: jobGradeId ?? null,
    salary_amount: salary === "" ? null : Number(salary),
    currency: "KWD",
    employment_type: employmentType ?? null,
    contract_type: contractType ?? null,
    start_date: startDate || null,
    probation_months: probation === "" ? null : Number(probation),
    terms_en: termsEn || null,
    terms_ar: termsAr || null,
    expiry_date: expiry || null,
  });

  const saveDraft = async (): Promise<string | null> => {
    if (editing && offer) {
      await updateDraftOffer(offer.id, buildPatch());
      return offer.id;
    }
    const rec = await createDraftOffer(buildPatch(), currentUserId);
    return rec.id;
  };

  const onSaveDraft = async () => {
    setBusy(true);
    try {
      const id = await saveDraft();
      toast.success(t("offers.toasts.draftSaved"));
      if (id) onSaved(id);
    } catch {
      toast.error(t("offers.toasts.saveError"));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async () => {
    if (salary === "") {
      toast.error(t("offers.toasts.saveError"));
      return;
    }
    setBusy(true);
    try {
      const id = await saveDraft();
      if (id) {
        await submitOffer(id);
        toast.success(t("offers.toasts.submitted"));
        onSaved(id);
      }
    } catch {
      toast.error(t("offers.toasts.actionError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.grade")}</Label>
          <Select value={jobGradeId} onValueChange={setJobGradeId}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("offers.form.grade")} /></SelectTrigger>
            <SelectContent>
              {(gradesQ.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{localized(g)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.salary")} ({t("offers.form.currency")})</Label>
          <Input type="number" min={0} step={1} dir="ltr" value={salary} onChange={(e) => setSalary(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.employmentType")}</Label>
          <Select value={employmentType} onValueChange={setEmploymentType}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("offers.form.employmentType")} /></SelectTrigger>
            <SelectContent>
              {(empTypesQ.data ?? []).map((o) => <SelectItem key={o.code} value={o.code}>{localized(o)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.contractType")}</Label>
          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("offers.form.contractType")} /></SelectTrigger>
            <SelectContent>
              {(contractTypesQ.data ?? []).map((o) => <SelectItem key={o.code} value={o.code}>{localized(o)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.startDate")}</Label>
          <Input type="date" dir="ltr" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.probation")}</Label>
          <Input type="number" min={0} step={1} dir="ltr" value={probation} onChange={(e) => setProbation(e.target.value)} className="h-9 w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.expiry")}</Label>
          <Input type="date" dir="ltr" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-9" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.termsEn")}</Label>
          <Textarea dir="ltr" rows={3} value={termsEn} onChange={(e) => setTermsEn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("offers.form.termsAr")}</Label>
          <Textarea dir="rtl" rows={3} value={termsAr} onChange={(e) => setTermsAr(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onSaveDraft} disabled={busy || !canWriteOffer}>
          {busy ? t("offers.actions.saving") : t("offers.actions.saveDraft")}
        </Button>
        <Button onClick={onSubmit} disabled={busy || salary === "" || !canWriteOffer || !canSubmitOffer}>
          {t("offers.actions.submit")}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t("offers.actions.cancelEdit")}</Button>
        )}
      </div>
    </div>
  );
}
