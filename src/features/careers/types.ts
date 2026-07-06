// Module M1.4 — Careers Portal (public): types.
export interface PublicJob {
  id: string;
  reference: string | null;
  title_en: string | null;
  title_ar: string | null;
  employment_type: string | null;
  department_en: string | null;
  department_ar: string | null;
  created_at: string;
}

export interface PublicJobDetail {
  job: {
    id: string;
    reference: string | null;
    title_en: string | null;
    title_ar: string | null;
    employment_type: string | null;
    contract_type: string | null;
  } | null;
  department: { name_en: string | null; name_ar: string | null } | null;
  jd: { summary_en: string | null; summary_ar: string | null } | null;
}

export interface PublicApplyInput {
  job_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  nationality: string | null;
  cover: string | null;
  resume_ref?: string | null;
}

export interface PublicApplyResult {
  application_id: string | null;
  candidate_id?: string | null;
  reference: string | null;
  duplicate: boolean;
}
