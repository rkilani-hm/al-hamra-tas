// Module M0.1 — Identity & Access: create a delegation.
// type (role_wide | task_specific), delegate picker, date range, confirm.
// Uses shadcn Dialog + Select + Input(date). RTL-safe via logical classes.

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
import type {
  CreateDelegationInput,
  DelegationType,
  UserWithAccess,
} from "../types";

interface DelegationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The delegator (the user whose access is being delegated).
  delegator: UserWithAccess | null;
  // Candidate delegates (other users).
  candidates: UserWithAccess[];
  onConfirm: (input: CreateDelegationInput) => void;
  saving?: boolean;
}

export function DelegationModal({
  open,
  onOpenChange,
  delegator,
  candidates,
  onConfirm,
  saving,
}: DelegationModalProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [delegateId, setDelegateId] = useState<string | null>(null);
  const [type, setType] = useState<DelegationType>("role_wide");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setDelegateId(null);
      setType("role_wide");
      setStartDate("");
      setEndDate("");
    }
  }, [open, delegator?.id]);

  const name = (u: UserWithAccess) =>
    (language === "ar" ? u.display_name_ar : u.display_name_en) || u.email;

  // Cannot delegate to self.
  const delegateOptions = candidates.filter((c) => c.id !== delegator?.id);

  const datesValid = !startDate || !endDate || startDate <= endDate;
  const canConfirm =
    Boolean(delegator && delegateId) && datesValid && !saving;

  const handleConfirm = () => {
    if (!delegator || !delegateId) return;
    onConfirm({
      delegator_user_id: delegator.id,
      delegate_user_id: delegateId,
      type,
      scope_json: [],
      start_date: startDate || null,
      end_date: endDate || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("identity.delegation.title")}</DialogTitle>
          <DialogDescription>
            {delegator
              ? t("identity.delegation.subtitle", { name: name(delegator) })
              : t("identity.delegation.subtitleEmpty")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Delegate */}
          <div className="flex flex-col gap-2">
            <Label>{t("identity.delegation.delegate")}</Label>
            <Select
              value={delegateId ?? undefined}
              onValueChange={setDelegateId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("identity.delegation.delegatePlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {delegateOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {name(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-2">
            <Label>{t("identity.delegation.type")}</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DelegationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role_wide">
                  {t("identity.delegation.types.role_wide")}
                </SelectItem>
                <SelectItem value="task_specific">
                  {t("identity.delegation.types.task_specific")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start">{t("identity.delegation.startDate")}</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end">{t("identity.delegation.endDate")}</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {!datesValid && (
            <p className="text-xs text-destructive">
              {t("identity.delegation.dateError")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("identity.buttons.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {t("identity.buttons.delegate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
