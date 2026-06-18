// Module M0.3 — vertical approval stepper for one instance.
// EXPORTED reusable component for request modules (M1.2 / M1.9 …).
// RTL-mirrored: the rail sits on the inline-start edge; current step highlighted.

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Clock, X, RotateCcw, Ban, CircleDot } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { instanceTimeline } from "../api";
import type { TaskStatus, WorkflowStep, WorkflowTask } from "../types";
import { WorkflowStatusBadge } from "./WorkflowStatusBadge";

interface ApprovalTimelineProps {
  instanceId: string;
}

const TASK_ICON: Record<TaskStatus, typeof Check> = {
  approved: Check,
  rejected: X,
  changes_requested: RotateCcw,
  reassigned: RotateCcw,
  skipped: CircleDot,
  escalated: Clock,
  pending: Clock,
};

export function ApprovalTimeline({ instanceId }: ApprovalTimelineProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const q = useQuery({
    queryKey: ["workflow", "timeline", instanceId],
    queryFn: () => instanceTimeline(instanceId),
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("workflow.common.loading")}</p>;
  }
  const data = q.data;
  if (!data || !data.instance) {
    return <p className="text-sm text-muted-foreground">{t("workflow.timeline.empty")}</p>;
  }

  const { instance, steps, tasks } = data;
  const stepName = (s: WorkflowStep) => (language === "ar" ? s.name_ar : s.name_en);
  const tasksFor = (stepNo: number) => tasks.filter((tk) => tk.step_no === stepNo);

  const comment = (tk: WorkflowTask) =>
    (language === "ar" ? tk.decision_comment_ar : tk.decision_comment_en) ||
    tk.decision_comment_en ||
    tk.decision_comment_ar ||
    "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">{t("workflow.timeline.title")}</h3>
        <WorkflowStatusBadge status={instance.status} />
      </div>

      <ol className="space-y-0">
        {steps.map((step) => {
          const isCurrent =
            instance.status === "in_progress" && step.step_no === instance.current_step;
          const stepTasks = tasksFor(step.step_no);
          return (
            <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {/* Rail (inline-start; mirrors in RTL) */}
              <div className="flex flex-col items-center">
                <span
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {step.step_no}
                </span>
                <span className="mt-1 w-px flex-1 bg-border" />
              </div>

              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{stepName(step)}</span>
                  {isCurrent && (
                    <span className="text-xs text-primary">{t("workflow.timeline.current")}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t("workflow.builder.quorum")}: {step.quorum}
                  </span>
                </div>

                {stepTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("workflow.timeline.noTasks")}</p>
                ) : (
                  <ul className="space-y-1">
                    {stepTasks.map((tk) => {
                      const Icon = TASK_ICON[tk.status] ?? Clock;
                      return (
                        <li key={tk.id} className="flex items-start gap-2 text-sm">
                          <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <span className="flex flex-wrap items-center gap-x-2">
                            <span className="text-foreground">
                              {t(`workflow.taskStatus.${tk.status}`)}
                            </span>
                            {tk.resolved_via !== "direct" && (
                              <span className="text-xs text-muted-foreground">
                                ({t(`workflow.resolvedVia.${tk.resolved_via}`)})
                              </span>
                            )}
                            {tk.acted_at && (
                              <span className="text-xs text-muted-foreground" dir="ltr">
                                {new Date(tk.acted_at).toLocaleString()}
                              </span>
                            )}
                            {comment(tk) && (
                              <span className="text-xs text-muted-foreground">“{comment(tk)}”</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {instance.status === "blocked" && isCurrent && (
                <Ban className="h-4 w-4 text-destructive" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
