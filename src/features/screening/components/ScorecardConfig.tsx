// Module M1.6 — ScorecardConfig: admin view of screening scorecards + criteria.
// Config writes are service-role until role-based access (M3.1), so edit
// affordances fail-soft with a clear toast rather than attempting a denied write.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";
import { listScreeningScorecards, safe } from "../api";

export function ScorecardConfig() {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const cardsQ = useQuery({
    queryKey: ["screening", "scorecards"],
    queryFn: safe(listScreeningScorecards),
  });
  const cards = cardsQ.data ?? [];

  const name = (c: { name_en: string; name_ar: string }) =>
    language === "ar" ? c.name_ar : c.name_en;
  const failSoft = () => toast.info(t("screening.config.readOnly"));

  if (cardsQ.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("screening.common.loading")}</p>;
  }
  if (cards.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("screening.config.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("screening.config.readOnly")}</p>
      {cards.map((card) => (
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
            <Button variant="outline" size="sm" onClick={failSoft}>
              {t("screening.config.addCriterion")}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
