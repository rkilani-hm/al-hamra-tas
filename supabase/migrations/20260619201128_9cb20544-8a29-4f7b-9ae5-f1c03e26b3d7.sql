insert into public.tas_workflow_step
  (definition_id, step_no, name_en, name_ar, approver_rule_type, approver_rule_value, condition_json, quorum, on_reject)
select d.id, 3, 'High-Salary Approval', 'اعتماد الراتب المرتفع', 'role', '{"role_code":"APPROVER"}'::jsonb,
       '{"field":"salary_amount","op":">=","value":2000}'::jsonb, 1, 'stop'
from public.tas_workflow_definition d
where d.request_type = 'offer' and d.version = 1
on conflict (definition_id, step_no) do nothing;

insert into public.tas_notification_template
  (type_code, channel, subject_en, subject_ar, body_en, body_ar, variables_json, status, version) values
  ('offer.submitted', 'in_app',
   'Offer submitted: {{reference}}', 'تم تقديم العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} ({{salary}}) was submitted for approval.',
   'تم تقديم العرض {{reference}} لـ {{candidate}} ({{salary}}) للاعتماد.',
   '["reference","candidate","salary","status"]', 'active', 1),
  ('offer.approved', 'in_app',
   'Offer approved: {{reference}}', 'تم اعتماد العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} has been approved and can be issued.',
   'تم اعتماد العرض {{reference}} لـ {{candidate}} ويمكن إصداره.',
   '["reference","candidate","salary","status"]', 'active', 1),
  ('offer.rejected', 'in_app',
   'Offer rejected: {{reference}}', 'تم رفض العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} was rejected in approval.',
   'تم رفض العرض {{reference}} لـ {{candidate}} أثناء الاعتماد.',
   '["reference","candidate","salary","status"]', 'active', 1),
  ('offer.issued', 'in_app',
   'Offer issued: {{reference}}', 'تم إصدار العرض: {{reference}}',
   'Offer {{reference}} for {{candidate}} ({{salary}}) has been issued.',
   'تم إصدار العرض {{reference}} لـ {{candidate}} ({{salary}}).',
   '["reference","candidate","salary","status"]', 'active', 1),
  ('offer.accepted', 'in_app',
   'Offer accepted: {{reference}}', 'تم قبول العرض: {{reference}}',
   '{{candidate}} accepted offer {{reference}}. Onboarding can begin.',
   'قبل {{candidate}} العرض {{reference}}. يمكن بدء الإعداد الوظيفي.',
   '["reference","candidate","salary","status"]', 'active', 1),
  ('offer.declined', 'in_app',
   'Offer declined: {{reference}}', 'تم رفض العرض من المرشح: {{reference}}',
   '{{candidate}} declined offer {{reference}}.',
   'رفض {{candidate}} العرض {{reference}}.',
   '["reference","candidate","salary","status"]', 'active', 1)
on conflict (type_code, channel, version) do nothing;