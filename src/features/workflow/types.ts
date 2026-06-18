// Module M0.3 — Workflow & Approval Engine: TypeScript types.
// Mirrors supabase/migrations/20260617220000_m0_3_workflow.sql + RPC return shapes.

export type DefinitionStatus = "draft" | "active" | "archived";
export type ApproverRuleType = "role" | "hierarchy" | "named_user";
export type OnReject = "stop" | "return";
export type InstanceStatus =
  | "in_progress"
  | "approved"
  | "rejected"
  | "returned"
  | "blocked";
export type TaskStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "reassigned"
  | "skipped"
  | "escalated";
export type ResolvedVia = "direct" | "delegation" | "reassign";
export type ConditionOp = "=" | "!=" | ">" | ">=" | "<" | "<=" | "in";
export type TaskAction = "approve" | "reject" | "request_changes" | "reassign";

// Approver rule value shapes (discriminated by ApproverRuleType).
export interface RoleRuleValue {
  role_code: string;
}
export interface HierarchyRuleValue {
  relative: "branch_manager" | "department_head" | "entity_admin";
}
export interface NamedUserRuleValue {
  user_id: string;
}
export type ApproverRuleValue =
  | RoleRuleValue
  | HierarchyRuleValue
  | NamedUserRuleValue
  | Record<string, unknown>;

export interface ConditionExpr {
  field: string;
  op: ConditionOp;
  value: unknown;
}

// --- Tables -----------------------------------------------------------------
export interface WorkflowDefinition {
  id: string;
  request_type: string;
  version: number;
  name_en: string;
  name_ar: string;
  status: DefinitionStatus;
}

export interface WorkflowStep {
  id: string;
  definition_id: string;
  step_no: number;
  name_en: string;
  name_ar: string;
  approver_rule_type: ApproverRuleType;
  approver_rule_value: ApproverRuleValue;
  condition_json: ConditionExpr | null;
  quorum: number;
  sla_hours: number | null;
  on_reject: OnReject;
}

export interface WorkflowInstance {
  id: string;
  definition_id: string;
  request_type: string;
  request_ref: string | null;
  requester_user_id: string | null;
  entity_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  status: InstanceStatus;
  current_step: number;
  context_json: Record<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  instance_id: string;
  step_no: number;
  assignee_user_id: string | null;
  resolved_via: ResolvedVia;
  status: TaskStatus;
  decision_comment_en: string | null;
  decision_comment_ar: string | null;
  due_at: string | null;
  acted_at: string | null;
}

export interface WorkflowHistoryEntry {
  id: string;
  instance_id: string;
  step_no: number | null;
  actor_user_id: string | null;
  action: string | null;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
}

// --- View models (RPC return shapes) ---------------------------------------

// my_pending_tasks(p_user_id)
export interface PendingTask {
  task_id: string;
  instance_id: string;
  step_no: number;
  request_type: string;
  request_ref: string | null;
  instance_status: InstanceStatus;
  resolved_via: ResolvedVia;
  due_at: string | null;
  created_at: string;
}

// instance_timeline(p_instance_id)
export interface InstanceTimeline {
  instance: WorkflowInstance | null;
  steps: WorkflowStep[];
  tasks: WorkflowTask[];
  history: WorkflowHistoryEntry[];
}

// Builder draft (client-side, before persistence).
export interface StepDraft {
  id?: string;
  step_no: number;
  name_en: string;
  name_ar: string;
  approver_rule_type: ApproverRuleType;
  approver_rule_value: ApproverRuleValue;
  condition_json: ConditionExpr | null;
  quorum: number;
  sla_hours: number | null;
  on_reject: OnReject;
}

export const CONDITION_OPS: ConditionOp[] = ["=", "!=", ">", ">=", "<", "<=", "in"];
