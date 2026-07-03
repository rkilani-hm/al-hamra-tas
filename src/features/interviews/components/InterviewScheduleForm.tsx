// Module M1.7 — InterviewScheduleForm: schedule an interview for an application.
// Round type (tas_lookup), date/time, duration, mode, panel multi-select (TAS
// users), scorecard (defaults to DEFAULT_SCREENING). On save, reports whether
// the calendar/Teams was created or it was recorded in-app (M365 not configured).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useLanguage } from "@/hooks/use-language";
import { listUsers } from "@/features/identity/api";
import { listAdapters } from "@/features/notifications/api";
import { listScreeningScorecards } from "@/features/screening/api";
import { listRoundTypes, scheduleInterview, safe } from "../api";
import { listMeetingRooms } from "../roomsApi";
import type { InterviewMode } from "../types";

interface InterviewScheduleFormProps {
  applicationId: string;
  onScheduled: () => void;
  onCancel?: () => void;
}

export function InterviewScheduleForm({ applicationId, onScheduled, onCancel }: InterviewScheduleFormProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const roundsQ = useQuery({ queryKey: ["interviews", "rounds"], queryFn: safe(listRoundTypes) });
  const usersQ = useQuery({ queryKey: ["identity", "users"], queryFn: safe(listUsers) });
  const cardsQ = useQuery({ queryKey: ["screening", "scorecards"], queryFn: safe(listScreeningScorecards) });
  const adaptersQ = useQuery({ queryKey: ["notifications", "adapters"], queryFn: safe(listAdapters) });
  const roomsQ = useQuery({ queryKey: ["interviews", "rooms"], queryFn: listMeetingRooms });

  const rounds = roundsQ.data ?? [];
  const users = usersQ.data ?? [];
  const cards = cardsQ.data ?? [];
  const adapters = adaptersQ.data ?? [];
  const rooms = roomsQ.data ?? [];

  const calendarLive = useMemo(
    () =>
      adapters.some(
        (a) => (a.channel === "outlook_email" || a.channel === "teams") && a.is_enabled && a.config_status === "configured",
      ),
    [adapters],
  );

  const [roundType, setRoundType] = useState<string | undefined>(undefined);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [mode, setMode] = useState<InterviewMode>("onsite");
  const [location, setLocation] = useState("");
  const [roomEmail, setRoomEmail] = useState<string | undefined>(undefined);
  const [scorecardId, setScorecardId] = useState<string | undefined>(undefined);
  const [panel, setPanel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const userName = (u: { display_name_en: string | null; display_name_ar: string | null; email: string }) =>
    (language === "ar" ? u.display_name_ar : u.display_name_en) || u.display_name_en || u.email;

  const togglePanel = (id: string) => setPanel((p) => ({ ...p, [id]: !p[id] }));

  const onSave = async () => {
    setBusy(true);
    try {
      await scheduleInterview({
        applicationId,
        roundType: roundType ?? null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        durationMin: Number(durationMin) || 60,
        mode,
        location: location || null,
        roomEmail: mode === "onsite" ? (roomEmail ?? null) : null,
        roomName: mode === "onsite" ? (rooms.find((r) => r.email === roomEmail)?.name ?? null) : null,
        panelistIds: Object.keys(panel).filter((id) => panel[id]),
        scorecardId: scorecardId ?? null,
      });
      toast.success(t("interviews.toasts.scheduled"));
      if (!calendarLive) toast.info(t("interviews.schedule.recordedInApp"));
      onScheduled();
    } catch {
      toast.error(t("interviews.toasts.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.roundType")}</Label>
          <Select value={roundType} onValueChange={setRoundType}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("interviews.schedule.roundType")} /></SelectTrigger>
            <SelectContent>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={r.code}>{language === "ar" ? r.name_ar : r.name_en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.datetime")}</Label>
          <Input type="datetime-local" dir="ltr" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.duration")}</Label>
          <Input type="number" min={15} step={15} dir="ltr" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className="h-9 w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.mode")}</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as InterviewMode)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="onsite">{t("interviews.mode.onsite")}</SelectItem>
              <SelectItem value="teams">{t("interviews.mode.teams")}</SelectItem>
              <SelectItem value="phone">{t("interviews.mode.phone")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "onsite" && rooms.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{t("interviews.schedule.room")}</Label>
            <Select value={roomEmail} onValueChange={setRoomEmail}>
              <SelectTrigger className="h-9"><SelectValue placeholder={t("interviews.schedule.roomPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.email} value={r.email}>
                    {r.name}{r.capacity ? ` · ${r.capacity}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.location")}</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} className="h-9" placeholder={mode === "onsite" && roomEmail ? t("interviews.schedule.locationRoomHint") : undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{t("interviews.schedule.scorecard")}</Label>
          <Select value={scorecardId} onValueChange={setScorecardId}>
            <SelectTrigger className="h-9"><SelectValue placeholder={t("interviews.schedule.scorecard")} /></SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={c.id}>{language === "ar" ? c.name_ar : c.name_en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">{t("interviews.schedule.panel")}</Label>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("interviews.schedule.noUsers")}</p>
        ) : (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!panel[u.id]} onChange={() => togglePanel(u.id)} className="h-4 w-4" />
                <span className="text-foreground">{userName(u)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {!calendarLive && (
        <p className="text-xs text-muted-foreground">{t("interviews.schedule.recordedInApp")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={busy}>
          {busy ? t("interviews.actions.saving") : t("interviews.actions.schedule")}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("interviews.actions.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
