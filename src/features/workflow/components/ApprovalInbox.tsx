// Module M0.3 — My Approvals inbox: pending tasks + decide.
// Actions: Approve / Reject / Request changes / Reassign, with bilingual comment.
//
// Needs the caller's tas_user id (p_user_id). Real Entra sign-in wiring lands
// later, so `currentUserId` is null for now → the inbox shows a sign-in notice.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Clock, RotateCcw, UserCog, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/features/auth/AuthProvider";
import { listUsers } from "@/features/identity/api";
import { actOnTask, myPendingTasks, safe } from "../api";
import type { PendingTask, TaskAction } from "../types";

interface ApprovalInboxProps {
  currentUserId?: string | null;
}

const ACTION_META: Record<TaskAction, { icon: typeof Check; needsTarget?: boolean }> = {
  approve: { icon: Check },
  reject: { icon: X },
  request_changes: { icon: RotateCcw },
  reassign: { icon: UserCog, needsTarget: true },
};

export function ApprovalInbox({ currentUserId }: ApprovalInboxProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { capabilities } = useAuth();
  const canAct = capabilities.includes("approval.act");
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["workflow", "inbox", currentUserId],
    queryFn: safe(() => (currentUserId ? myPendingTasks(currentUserId) : Promise.resolve([]))),
    enabled: Boolean(currentUserId),
  });
  const usersQ = useQuery({ queryKey: ["workflow", "users"], queryFn: listUsers });
  const users = usersQ.data ?? [];
  const tasks = q.data ?? [];

  const [task, setTask] = useState<PendingTask | null>(null);
  const [action, setAction] = useState<TaskAction>("approve");
  const [commentEn, setCommentEn] = useState("");
  const [commentAr, setCommentAr] = useState("");
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return id;
    return (language === "ar" ? u.display_name_ar : u.display_name_en) || u.email;
  };

  const openDecide = (tk: PendingTask) => {
    setTask(tk);
    setAction("approve");
    setCommentEn("");
    setCommentAr("");
    setTarget("");
  };

  const submit = async () => {
    if (!task) return;
    if (ACTION_META[action].needsTarget && !target) return;
    setSaving(true);
    try {
      await actOnTask({
        task_id: task.task_id,
        action,
        comment: commentEn.trim() || null,
        comment_ar: commentAr.trim() || null,
        target: ACTION_META[action].needsTarget ? target : null,
      });
      toast.success(t("workflow.toasts.decisionRecorded"));
      setTask(null);
      await qc.invalidateQueries({ queryKey: ["workflow", "inbox", currentUserId] });
    } catch {
      toast.error(t("workflow.toasts.actionError"));
    } finally {
      setSaving(false);
    }
  };

  if (!currentUserId) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t("workflow.inbox.signInRequired")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("workflow.inbox.title")}</h2>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("workflow.fields.requestType")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.requestRef")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.step")}</TableHead>
              <TableHead className="text-start">{t("workflow.fields.due")}</TableHead>
              <TableHead className="text-end">{t("workflow.fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">…</TableCell>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  {t("workflow.inbox.empty")}
                </TableCell>
              </TableRow>
            ) : (
              tasks.map((tk) => (
                <TableRow key={tk.task_id}>
                  <TableCell><Badge variant="outline">{tk.request_type}</Badge></TableCell>
                  <TableCell className="font-medium">{tk.request_ref ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{tk.step_no}</TableCell>
                  <TableCell className="text-muted-foreground" dir="ltr">
                    {tk.due_at ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(tk.due_at).toLocaleString()}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    {canAct && (
                      <Button variant="ghost" size="sm" onClick={() => openDecide(tk)}>
                        {t("workflow.inbox.decide")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(task)} onOpenChange={(o) => !o && setTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("workflow.inbox.decideTitle")}</DialogTitle>
            <DialogDescription>
              {task ? `${task.request_type} · ${task.request_ref ?? ""}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label>{t("workflow.inbox.action")}</Label>
              <Select value={action} onValueChange={(v) => setAction(v as TaskAction)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approve">{t("workflow.actions.approve")}</SelectItem>
                  <SelectItem value="reject">{t("workflow.actions.reject")}</SelectItem>
                  <SelectItem value="request_changes">{t("workflow.actions.request_changes")}</SelectItem>
                  <SelectItem value="reassign">{t("workflow.actions.reassign")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ACTION_META[action].needsTarget && (
              <div className="flex flex-col gap-2">
                <Label>{t("workflow.inbox.reassignTo")}</Label>
                <Select value={target || undefined} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder={t("workflow.builder.pickUser")} /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{userName(u.id)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{t("workflow.inbox.commentEn")}</Label>
                <Textarea value={commentEn} onChange={(e) => setCommentEn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t("workflow.inbox.commentAr")}</Label>
                <Textarea dir="rtl" value={commentAr} onChange={(e) => setCommentAr(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTask(null)} disabled={saving}>
              {t("workflow.buttons.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving || !canAct || (ACTION_META[action].needsTarget && !target)}>
              {t("workflow.inbox.submitDecision")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
