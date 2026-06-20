// Module M1.6 — ScorecardConfig: admin view + management of screening scorecards
// + criteria. Writes go through the M3.1-step1 SYSTEM_ADMIN-gated config RPCs
// (config_upsert_scorecard / config_upsert_criterion). Write controls are hidden
// for non-admins (no dead buttons); the RPC rejects as a backstop.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { isSystemAdmin } from "@/features/admin/RequireAdmin";
import { adminErrorCode } from "@/features/admin/api";
import { listScreeningScorecards, safe, upsertCriterion, upsertScorecard } from "../api";

export function ScorecardConfig() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { roles } = useAuth();
  const canWrite = isSystemAdmin(roles);
  const qc = useQueryClient();

  const cardsQ = useQuery({
    queryKey: ["screening", "scorecards"],
    queryFn: safe(listScreeningScorecards),
  });
  const cards = cardsQ.data ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["screening", "scorecards"] });

  const name = (c: { name_en: string; name_ar: string }) => (language === "ar" ? c.name_ar : c.name_en);

  // Add-scorecard dialog
  const [scOpen, setScOpen] = useState(false);
  const [scCode, setScCode] = useState("");
  const [scEn, setScEn] = useState("");
  const [scAr, setScAr] = useState("");
  // Add-criterion dialog (per scorecard)
  const [critFor, setCritFor] = useState<string | null>(null);
  const [crCode, setCrCode] = useState("");
  const [crEn, setCrEn] = useState("");
  const [crAr, setCrAr] = useState("");
  const [crWeight, setCrWeight] = useState("1");
  const [crMax, setCrMax] = useState("5");
  const [busy, setBusy] = useState(false);

  const onError = (err: unknown) => {
    const code = adminErrorCode(err);
    toast.error(code ? t(`admin.errors.${code}`) : t("screening.toasts.error"));
  };

  const saveScorecard = async () => {
    if (!scCode.trim() || !scEn.trim() || !scAr.trim()) return;
    setBusy(true);
    try {
      await upsertScorecard({ code: scCode.trim(), name_en: scEn.trim(), name_ar: scAr.trim() });
      toast.success(t("screening.toasts.saved"));
      setScOpen(false); setScCode(""); setScEn(""); setScAr("");
      refresh();
    } catch (err) { onError(err); } finally { setBusy(false); }
  };

  const saveCriterion = async () => {
    if (!critFor || !crCode.trim() || !crEn.trim() || !crAr.trim()) return;
    setBusy(true);
    try {
      await upsertCriterion({
        scorecard_id: critFor, code: crCode.trim(), name_en: crEn.trim(), name_ar: crAr.trim(),
        weight: crWeight.trim() ? Number(crWeight) : 1, max_score: crMax.trim() ? Number(crMax) : 5,
      });
      toast.success(t("screening.toasts.saved"));
      setCritFor(null); setCrCode(""); setCrEn(""); setCrAr(""); setCrWeight("1"); setCrMax("5");
      refresh();
    } catch (err) { onError(err); } finally { setBusy(false); }
  };

  if (cardsQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("screening.common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("screening.config.subtitle")}</p>
        {canWrite && (
          <Button size="sm" className="gap-1" onClick={() => setScOpen(true)}>
            <Plus className="h-4 w-4" /> {t("screening.config.addScorecard")}
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("screening.config.empty")}
        </p>
      ) : (
        cards.map((card) => (
          <Card key={card.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">{name(card)}</CardTitle>
                <Badge variant="outline">{card.code}</Badge>
                <Badge variant={card.status === "active" ? "default" : "secondary"}>{card.status}</Badge>
              </div>
              {(language === "ar" ? card.description_ar : card.description_en) && (
                <CardDescription>
                  {language === "ar" ? card.description_ar : card.description_en}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 pe-3 text-start font-medium">{t("screening.config.code")}</th>
                      <th className="py-2 px-3 text-start font-medium">{t("screening.config.nameEn")}</th>
                      <th className="py-2 px-3 text-start font-medium">{t("screening.config.nameAr")}</th>
                      <th className="py-2 px-3 text-start font-medium">{t("screening.config.weight")}</th>
                      <th className="py-2 px-3 text-start font-medium">{t("screening.config.max")}</th>
                      <th className="py-2 ps-3 text-start font-medium">{t("screening.config.order")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.criteria.map((cr) => (
                      <tr key={cr.id} className="border-b last:border-0">
                        <td className="py-2 pe-3 text-muted-foreground">{cr.code}</td>
                        <td className="py-2 px-3 text-foreground">{cr.name_en}</td>
                        <td className="py-2 px-3 text-foreground">{cr.name_ar}</td>
                        <td className="py-2 px-3 text-muted-foreground" dir="ltr">{cr.weight}</td>
                        <td className="py-2 px-3 text-muted-foreground" dir="ltr">{cr.max_score}</td>
                        <td className="py-2 ps-3 text-muted-foreground" dir="ltr">{cr.sort_order}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canWrite && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setCritFor(card.id)}>
                  <Plus className="h-4 w-4" /> {t("screening.config.addCriterion")}
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Add scorecard dialog */}
      <Dialog open={scOpen} onOpenChange={setScOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("screening.config.addScorecard")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("screening.config.code")}</Label>
              <Input value={scCode} onChange={(e) => setScCode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.nameEn")}</Label>
                <Input value={scEn} onChange={(e) => setScEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.nameAr")}</Label>
                <Input dir="rtl" value={scAr} onChange={(e) => setScAr(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScOpen(false)} disabled={busy}>{t("screening.config.cancel")}</Button>
            <Button onClick={saveScorecard} disabled={busy || !scCode.trim() || !scEn.trim() || !scAr.trim()}>{t("screening.config.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add criterion dialog */}
      <Dialog open={critFor !== null} onOpenChange={(o) => { if (!o) setCritFor(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t("screening.config.addCriterion")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("screening.config.code")}</Label>
              <Input value={crCode} onChange={(e) => setCrCode(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.nameEn")}</Label>
                <Input value={crEn} onChange={(e) => setCrEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.nameAr")}</Label>
                <Input dir="rtl" value={crAr} onChange={(e) => setCrAr(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.weight")}</Label>
                <Input type="number" dir="ltr" value={crWeight} onChange={(e) => setCrWeight(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("screening.config.max")}</Label>
                <Input type="number" dir="ltr" value={crMax} onChange={(e) => setCrMax(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCritFor(null)} disabled={busy}>{t("screening.config.cancel")}</Button>
            <Button onClick={saveCriterion} disabled={busy || !crCode.trim() || !crEn.trim() || !crAr.trim()}>{t("screening.config.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
