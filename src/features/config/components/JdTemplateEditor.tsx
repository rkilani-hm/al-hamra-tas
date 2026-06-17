// Module M0.2 — Core Configuration: JD template editor.
// Edit title/summary (EN+AR), manage ordered sections (add/remove/reorder),
// and attach competencies with proficiency. RTL-safe.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/use-language";
import {
  attachCompetency,
  createJdTemplate,
  detachCompetency,
  getJdTemplate,
  listCompetencies,
  safe,
  saveJdSections,
  updateJdTemplate,
} from "../api";
import type {
  JdSection,
  JdSectionType,
  JdStatus,
  JdTemplate,
} from "../types";

const SECTION_TYPES: JdSectionType[] = [
  "responsibilities",
  "requirements",
  "qualifications",
  "benefits",
  "other",
];
const JD_STATUSES: JdStatus[] = ["draft", "active", "archived"];

type SectionDraft = Omit<JdSection, "id" | "jd_template_id">;
interface CompDraft {
  competency_id: string;
  proficiency_level: number | null;
  name: string;
}

interface JdTemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: JdTemplate | null; // null = create
  onSaved: () => void;
}

export function JdTemplateEditor({
  open,
  onOpenChange,
  template,
  onSaved,
}: JdTemplateEditorProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const competenciesQ = useQuery({
    queryKey: ["config", "competencies"],
    queryFn: safe(listCompetencies),
  });
  const allCompetencies = competenciesQ.data ?? [];
  const compName = (c: { name_en: string; name_ar: string }) =>
    language === "ar" ? c.name_ar : c.name_en;

  // Header fields
  const [code, setCode] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [summaryAr, setSummaryAr] = useState("");
  const [status, setStatus] = useState<JdStatus>("draft");

  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [comps, setComps] = useState<CompDraft[]>([]);
  const [originalCompIds, setOriginalCompIds] = useState<string[]>([]);
  const [addCompId, setAddCompId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load detail when editing.
  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    if (!template) {
      setCode("");
      setTitleEn("");
      setTitleAr("");
      setSummaryEn("");
      setSummaryAr("");
      setStatus("draft");
      setSections([]);
      setComps([]);
      setOriginalCompIds([]);
      setAddCompId("");
      return;
    }

    setCode(template.code);
    setTitleEn(template.title_en);
    setTitleAr(template.title_ar);
    setSummaryEn(template.summary_en ?? "");
    setSummaryAr(template.summary_ar ?? "");
    setStatus(template.status);

    void getJdTemplate(template.id)
      .then((detail) => {
        if (cancelled || !detail) return;
        setSections(
          detail.sections.map((s) => ({
            section_type: s.section_type,
            heading_en: s.heading_en,
            heading_ar: s.heading_ar,
            body_en: s.body_en,
            body_ar: s.body_ar,
            sort_order: s.sort_order,
          })),
        );
        setComps(
          detail.competencies.map((c) => ({
            competency_id: c.competency_id,
            proficiency_level: c.proficiency_level,
            name: compName(c.competency),
          })),
        );
        setOriginalCompIds(detail.competencies.map((c) => c.competency_id));
      })
      .catch(() => {
        /* degrade silently — defensive guard against a failed detail read */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  // Section helpers
  const addSection = () =>
    setSections((s) => [
      ...s,
      { section_type: "responsibilities", heading_en: "", heading_ar: "", body_en: "", body_ar: "", sort_order: s.length },
    ]);
  const updateSection = (i: number, patch: Partial<SectionDraft>) =>
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  const removeSection = (i: number) =>
    setSections((s) => s.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setSections((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  // Competency helpers
  const availableComps = allCompetencies.filter(
    (c) => !comps.some((x) => x.competency_id === c.id),
  );
  const addComp = () => {
    if (!addCompId) return;
    const c = allCompetencies.find((x) => x.id === addCompId);
    if (!c) return;
    setComps((list) => [...list, { competency_id: c.id, proficiency_level: null, name: compName(c) }]);
    setAddCompId("");
  };

  const canSave = code.trim() && titleEn.trim() && titleAr.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        code: code.trim(),
        job_position_id: template?.job_position_id ?? null,
        title_en: titleEn.trim(),
        title_ar: titleAr.trim(),
        summary_en: summaryEn.trim() || null,
        summary_ar: summaryAr.trim() || null,
        status,
        version: template?.version ?? 1,
      };

      let templateId = template?.id;
      if (template) {
        await updateJdTemplate(template.id, payload);
      } else {
        const created = await createJdTemplate(payload);
        templateId = created.id;
      }
      if (!templateId) throw new Error("missing template id");

      // Sections: persist ordered set (sort_order = index).
      await saveJdSections(
        templateId,
        sections.map((s, i) => ({ ...s, sort_order: i })),
      );

      // Competencies: attach current, detach removed.
      for (const c of comps) {
        await attachCompetency(templateId, c.competency_id, c.proficiency_level);
      }
      const currentIds = new Set(comps.map((c) => c.competency_id));
      for (const id of originalCompIds) {
        if (!currentIds.has(id)) await detachCompetency(templateId, id);
      }

      toast.success(t("config.toasts.saved"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(t("config.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? t("config.jd.editTitle") : t("config.jd.addTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Header fields */}
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jd-code">{t("config.fields.code")}</Label>
                <Input id="jd-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("config.fields.status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as JdStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{t(`config.jdStatus.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jd-ten">{t("config.fields.titleEn")}</Label>
                <Input id="jd-ten" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="jd-tar">{t("config.fields.titleAr")}</Label>
                <Input id="jd-tar" dir="rtl" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="jd-sen">{t("config.fields.summaryEn")}</Label>
                <Textarea id="jd-sen" value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="jd-sar">{t("config.fields.summaryAr")}</Label>
                <Textarea id="jd-sar" dir="rtl" value={summaryAr} onChange={(e) => setSummaryAr(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">{t("config.jd.sections")}</h3>
              <Button size="sm" variant="outline" className="gap-1" onClick={addSection}>
                <Plus className="h-4 w-4" /> {t("config.jd.addSection")}
              </Button>
            </div>
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("config.jd.noSections")}</p>
            ) : (
              sections.map((sec, i) => (
                <div key={i} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Select
                      value={sec.section_type}
                      onValueChange={(v) => updateSection(i, { section_type: v as JdSectionType })}
                    >
                      <SelectTrigger className="max-w-[12rem]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SECTION_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>{t(`config.sectionType.${s}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("config.buttons.moveUp")} onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("config.buttons.moveDown")} onClick={() => move(i, 1)} disabled={i === sections.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t("config.buttons.remove")} onClick={() => removeSection(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder={t("config.fields.headingEn")} value={sec.heading_en ?? ""} onChange={(e) => updateSection(i, { heading_en: e.target.value })} />
                    <Input placeholder={t("config.fields.headingAr")} dir="rtl" value={sec.heading_ar ?? ""} onChange={(e) => updateSection(i, { heading_ar: e.target.value })} />
                    <Textarea placeholder={t("config.fields.bodyEn")} value={sec.body_en ?? ""} onChange={(e) => updateSection(i, { body_en: e.target.value })} />
                    <Textarea placeholder={t("config.fields.bodyAr")} dir="rtl" value={sec.body_ar ?? ""} onChange={(e) => updateSection(i, { body_ar: e.target.value })} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Competencies */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">{t("config.jd.competencies")}</h3>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label>{t("config.jd.addCompetency")}</Label>
                <Select value={addCompId || undefined} onValueChange={setAddCompId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("config.common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComps.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{compName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={addComp} disabled={!addCompId}>
                {t("config.buttons.add")}
              </Button>
            </div>
            {comps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("config.jd.noCompetencies")}</p>
            ) : (
              <div className="space-y-2">
                {comps.map((c, i) => (
                  <div key={c.competency_id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <span className="text-sm">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground" htmlFor={`prof-${i}`}>
                        {t("config.fields.proficiency")}
                      </Label>
                      <Input
                        id={`prof-${i}`}
                        type="number"
                        min={1}
                        max={5}
                        className="w-20"
                        value={c.proficiency_level ?? ""}
                        onChange={(e) =>
                          setComps((list) =>
                            list.map((x, idx) =>
                              idx === i
                                ? { ...x, proficiency_level: e.target.value ? Number(e.target.value) : null }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label={t("config.buttons.remove")}
                        onClick={() => setComps((list) => list.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
