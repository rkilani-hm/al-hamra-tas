// Route: /careers/:id — Module M1.4 public job detail + application form.
import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/use-language";
import { publicJobDetail, submitPublicApplication, uploadCareersCv } from "@/features/careers/api";

const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const CV_MAX_BYTES = 5 * 1024 * 1024;

export const Route = createFileRoute("/careers/$id")({
  head: () => ({ meta: [{ title: "Job — Al Hamra Careers" }] }),
  component: CareersJobPage,
});

function CareersJobPage() {
  const { t } = useTranslation();
  const { language, direction } = useLanguage();
  const { id } = useParams({ from: "/careers/$id" });
  const Chevron = direction === "rtl" ? ChevronRight : ChevronLeft;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [cover, setCover] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  const onPickCv = (file: File | null) => {
    if (!file) { setCv(null); return; }
    if (!CV_TYPES.includes(file.type)) { toast.error(t("careers.apply.cvType")); return; }
    if (file.size > CV_MAX_BYTES) { toast.error(t("careers.apply.cvTooLarge")); return; }
    setCv(file);
  };

  const q = useQuery({ queryKey: ["careers", "job", id], queryFn: () => publicJobDetail(id) });
  const job = q.data?.job ?? null;
  const dept = q.data?.department ?? null;
  const jd = q.data?.jd ?? null;

  const canSubmit = name.trim() && email.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const resumeRef = cv ? await uploadCareersCv(cv) : null;
      const r = await submitPublicApplication({
        job_id: id, full_name: name.trim(), email: email.trim(),
        phone: phone.trim() || null, nationality: nationality.trim() || null, cover: cover.trim() || null,
        resume_ref: resumeRef,
      }, language);
      setDoneRef(r.reference ?? "—");
      if (r.duplicate) toast.info(t("careers.apply.duplicate"));
      else toast.success(t("careers.apply.success"));
    } catch {
      toast.error(t("careers.apply.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir={direction} className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <Link to="/careers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Chevron className="h-4 w-4" /> {t("careers.back")}
      </Link>

      {q.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("careers.loading")}</p>
      ) : !job ? (
        <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">{t("careers.notFound")}</p>
      ) : (
        <div className="mt-6 space-y-6">
          <header>
            <h1 className="text-2xl font-semibold text-foreground">
              {(language === "ar" ? job.title_ar : job.title_en) || job.title_en || job.reference}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {(language === "ar" ? dept?.name_ar : dept?.name_en) || dept?.name_en || ""}
              {job.employment_type ? ` · ${job.employment_type}` : ""}
            </p>
          </header>

          {(jd?.summary_en || jd?.summary_ar) && (
            <section className="rounded-md border p-4">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {(language === "ar" ? jd?.summary_ar : jd?.summary_en) || ""}
              </p>
            </section>
          )}

          {doneRef ? (
            <section className="flex flex-col items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium text-foreground">{t("careers.apply.submitted")}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">{doneRef}</p>
            </section>
          ) : (
            <section className="space-y-3 rounded-md border p-4">
              <h2 className="font-medium text-foreground">{t("careers.apply.title")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("careers.apply.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("careers.apply.email")}</Label>
                  <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("careers.apply.phone")}</Label>
                  <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("careers.apply.nationality")}</Label>
                  <Input value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>{t("careers.apply.cover")}</Label>
                  <Textarea value={cover} onChange={(e) => setCover(e.target.value)} rows={3} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>{t("careers.apply.cv")}</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    dir="ltr"
                    onChange={(e) => onPickCv(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">{cv ? cv.name : t("careers.apply.cvHint")}</p>
                </div>
              </div>
              <Button onClick={submit} disabled={!canSubmit}>{t("careers.apply.submit")}</Button>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
