export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      tas_access_audit: {
        Row: {
          created_at: string
          detail_json: Json
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail_json?: Json
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail_json?: Json
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_access_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_ai_adapter_config: {
        Row: {
          config_status: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          model: string | null
          notes: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          model?: string | null
          notes?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          model?: string | null
          notes?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_application: {
        Row: {
          applied_at: string
          candidate_id: string
          created_at: string
          created_by: string | null
          current_stage_id: string | null
          id: string
          owner_user_id: string | null
          reference: string | null
          rejection_reason: string | null
          requisition_id: string
          source: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applied_at?: string
          candidate_id: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          owner_user_id?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requisition_id: string
          source?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_at?: string
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          current_stage_id?: string | null
          id?: string
          owner_user_id?: string | null
          reference?: string | null
          rejection_reason?: string | null
          requisition_id?: string
          source?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_application_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "tas_pipeline_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "tas_requisition"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_application_counter: {
        Row: {
          fiscal_year: number
          last_no: number
        }
        Insert: {
          fiscal_year: number
          last_no?: number
        }
        Update: {
          fiscal_year?: number
          last_no?: number
        }
        Relationships: []
      }
      tas_application_stage_history: {
        Row: {
          application_id: string
          created_at: string
          from_stage_id: string | null
          id: string
          moved_by: string | null
          note: string | null
          to_stage_id: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          moved_by?: string | null
          note?: string | null
          to_stage_id?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          moved_by?: string | null
          note?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_application_stage_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "tas_pipeline_stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_stage_history_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_application_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "tas_pipeline_stage"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_assessment: {
        Row: {
          application_id: string
          assessed_by: string | null
          assessment_type: string
          candidate_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          overall_score: number | null
          recommendation: string | null
          status: string
          submitted_at: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          assessed_by?: string | null
          assessment_type?: string
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          recommendation?: string | null
          status?: string
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          assessed_by?: string | null
          assessment_type?: string
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          recommendation?: string | null
          status?: string
          submitted_at?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_assessment_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_assessment_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_assessment_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_assessment_item: {
        Row: {
          assessment_id: string
          created_at: string
          created_by: string | null
          id: string
          label_ar: string | null
          label_en: string | null
          max_score: number
          note: string | null
          score: number | null
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          assessment_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_ar?: string | null
          label_en?: string | null
          max_score?: number
          note?: string | null
          score?: number | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          assessment_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_ar?: string | null
          label_en?: string | null
          max_score?: number
          note?: string | null
          score?: number | null
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tas_assessment_item_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "tas_assessment"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_audit_log: {
        Row: {
          actor_user_id: string | null
          created_at: string
          detail_json: Json
          entity_ref: string | null
          entity_type: string | null
          event_type: string | null
          id: string
          ip: string | null
          module_code: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          entity_ref?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string
          ip?: string | null
          module_code?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          entity_ref?: string | null
          entity_type?: string | null
          event_type?: string | null
          id?: string
          ip?: string | null
          module_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_branch: {
        Row: {
          address_ar: string | null
          address_en: string | null
          code: string
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          name_ar: string
          name_en: string
          paci_area: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          name_ar: string
          name_en: string
          paci_area?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          name_ar?: string
          name_en?: string
          paci_area?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_branch_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_budgeted_position: {
        Row: {
          branch_id: string | null
          budgeted_count: number
          created_at: string
          created_by: string | null
          department_id: string | null
          entity_id: string
          filled_count: number
          fiscal_year: string | null
          id: string
          job_position_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          budgeted_count?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id: string
          filled_count?: number
          fiscal_year?: string | null
          id?: string
          job_position_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          budgeted_count?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id?: string
          filled_count?: number
          fiscal_year?: string | null
          id?: string
          job_position_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_budgeted_position_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_budgeted_position_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_budgeted_position_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_budgeted_position_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "tas_job_position"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_candidate: {
        Row: {
          created_at: string
          created_by: string | null
          current_title: string | null
          email: string | null
          first_name: string | null
          full_name_ar: string | null
          full_name_en: string | null
          id: string
          last_name: string | null
          nationality: string | null
          nationality_class: string | null
          phone: string | null
          source: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_title?: string | null
          email?: string | null
          first_name?: string | null
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          nationality_class?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_title?: string | null
          email?: string | null
          first_name?: string | null
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          last_name?: string | null
          nationality?: string | null
          nationality_class?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_candidate_consent: {
        Row: {
          candidate_id: string
          consent_type: string
          created_at: string
          created_by: string | null
          granted: boolean
          granted_at: string | null
          id: string
          notes: string | null
          retention_until: string | null
          source: string | null
          updated_at: string
          updated_by: string | null
          withdrawn_at: string | null
        }
        Insert: {
          candidate_id: string
          consent_type: string
          created_at?: string
          created_by?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          notes?: string | null
          retention_until?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          candidate_id?: string
          consent_type?: string
          created_at?: string
          created_by?: string | null
          granted?: boolean
          granted_at?: string | null
          id?: string
          notes?: string | null
          retention_until?: string | null
          source?: string | null
          updated_at?: string
          updated_by?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_candidate_consent_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_comm_adapter_config: {
        Row: {
          channel: string
          config_status: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel: string
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_competency: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_delegation: {
        Row: {
          created_at: string
          created_by: string | null
          delegate_user_id: string
          delegator_user_id: string
          end_date: string | null
          id: string
          scope_json: Json
          start_date: string | null
          status: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delegate_user_id: string
          delegator_user_id: string
          end_date?: string | null
          id?: string
          scope_json?: Json
          start_date?: string | null
          status?: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delegate_user_id?: string
          delegator_user_id?: string
          end_date?: string | null
          id?: string
          scope_json?: Json
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_delegation_delegate_user_id_fkey"
            columns: ["delegate_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_delegation_delegator_user_id_fkey"
            columns: ["delegator_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_department: {
        Row: {
          branch_id: string
          code: string
          created_at: string
          created_by: string | null
          function_code: string | null
          id: string
          name_ar: string
          name_en: string
          parent_department_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
          code: string
          created_at?: string
          created_by?: string | null
          function_code?: string | null
          id?: string
          name_ar: string
          name_en: string
          parent_department_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          function_code?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          parent_department_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_department_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_department_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_document: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          linked_entity_ref: string | null
          linked_entity_type: string | null
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_provider: string
          storage_ref: string | null
          supersedes_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          linked_entity_ref?: string | null
          linked_entity_type?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_provider: string
          storage_ref?: string | null
          supersedes_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          linked_entity_ref?: string | null
          linked_entity_type?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_provider?: string
          storage_ref?: string | null
          supersedes_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tas_document_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "tas_document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_document_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_entity: {
        Row: {
          code: string
          commercial_reg_no: string | null
          created_at: string
          created_by: string | null
          id: string
          kuwaitization_target_pct: number | null
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          commercial_reg_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kuwaitization_target_pct?: number | null
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          commercial_reg_no?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kuwaitization_target_pct?: number | null
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_hrms_adapter_config: {
        Row: {
          config_status: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_interview: {
        Row: {
          application_id: string
          calendar_status: string
          created_at: string
          created_by: string | null
          duration_min: number
          id: string
          location: string | null
          mode: string
          outcome: string | null
          outlook_event_id: string | null
          reference: string | null
          round_type: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scorecard_id: string | null
          status: string
          teams_join_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          calendar_status?: string
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          location?: string | null
          mode?: string
          outcome?: string | null
          outlook_event_id?: string | null
          reference?: string | null
          round_type?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scorecard_id?: string | null
          status?: string
          teams_join_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          calendar_status?: string
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          location?: string | null
          mode?: string
          outcome?: string | null
          outlook_event_id?: string | null
          reference?: string | null
          round_type?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scorecard_id?: string | null
          status?: string
          teams_join_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_interview_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_scorecard"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_interview_counter: {
        Row: {
          fiscal_year: number
          last_no: number
        }
        Insert: {
          fiscal_year: number
          last_no?: number
        }
        Update: {
          fiscal_year?: number
          last_no?: number
        }
        Relationships: []
      }
      tas_interview_panelist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          role: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          role?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_interview_panelist_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "tas_interview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_panelist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_interview_score: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interview_id: string
          notes_en: string | null
          overall_score: number | null
          panelist_user_id: string | null
          recommendation: string | null
          scorecard_id: string | null
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id: string
          notes_en?: string | null
          overall_score?: number | null
          panelist_user_id?: string | null
          recommendation?: string | null
          scorecard_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interview_id?: string
          notes_en?: string | null
          overall_score?: number | null
          panelist_user_id?: string | null
          recommendation?: string | null
          scorecard_id?: string | null
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_interview_score_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "tas_interview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_score_panelist_user_id_fkey"
            columns: ["panelist_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_score_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_scorecard"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_interview_score_detail: {
        Row: {
          criterion_id: string
          id: string
          interview_score_id: string
          note: string | null
          score: number | null
        }
        Insert: {
          criterion_id: string
          id?: string
          interview_score_id: string
          note?: string | null
          score?: number | null
        }
        Update: {
          criterion_id?: string
          id?: string
          interview_score_id?: string
          note?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_interview_score_detail_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_criterion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_interview_score_detail_interview_score_id_fkey"
            columns: ["interview_score_id"]
            isOneToOne: false
            referencedRelation: "tas_interview_score"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_jd_competency: {
        Row: {
          competency_id: string
          jd_template_id: string
          proficiency_level: number | null
        }
        Insert: {
          competency_id: string
          jd_template_id: string
          proficiency_level?: number | null
        }
        Update: {
          competency_id?: string
          jd_template_id?: string
          proficiency_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_jd_competency_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "tas_competency"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_jd_competency_jd_template_id_fkey"
            columns: ["jd_template_id"]
            isOneToOne: false
            referencedRelation: "tas_jd_template"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_jd_section: {
        Row: {
          body_ar: string | null
          body_en: string | null
          heading_ar: string | null
          heading_en: string | null
          id: string
          jd_template_id: string
          section_type: string
          sort_order: number
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          heading_ar?: string | null
          heading_en?: string | null
          id?: string
          jd_template_id: string
          section_type: string
          sort_order?: number
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          heading_ar?: string | null
          heading_en?: string | null
          id?: string
          jd_template_id?: string
          section_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tas_jd_section_jd_template_id_fkey"
            columns: ["jd_template_id"]
            isOneToOne: false
            referencedRelation: "tas_jd_template"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_jd_template: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          job_position_id: string | null
          status: string
          summary_ar: string | null
          summary_en: string | null
          title_ar: string
          title_en: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_position_id?: string | null
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar: string
          title_en: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_position_id?: string | null
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tas_jd_template_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "tas_job_position"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_job_family: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_job_grade: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name_ar: string
          name_en: string
          rank: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar: string
          name_en: string
          rank?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          rank?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_job_position: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_kuwaitization_targeted: boolean
          job_family_id: string | null
          job_grade_id: string | null
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_kuwaitization_targeted?: boolean
          job_family_id?: string | null
          job_grade_id?: string | null
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_kuwaitization_targeted?: boolean
          job_family_id?: string | null
          job_grade_id?: string | null
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_job_position_job_family_id_fkey"
            columns: ["job_family_id"]
            isOneToOne: false
            referencedRelation: "tas_job_family"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_job_position_job_grade_id_fkey"
            columns: ["job_grade_id"]
            isOneToOne: false
            referencedRelation: "tas_job_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_lookup: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          lookup_type: string
          name_ar: string
          name_en: string
          sort_order: number
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          lookup_type: string
          name_ar: string
          name_en: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lookup_type?: string
          name_ar?: string
          name_en?: string
          sort_order?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_manpower_plan: {
        Row: {
          budgeted_headcount: number
          created_at: string
          created_by: string | null
          department_id: string | null
          entity_id: string | null
          fiscal_year: number
          id: string
          job_position_id: string | null
          kuwaitization_target_pct: number | null
          notes: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          budgeted_headcount?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id?: string | null
          fiscal_year: number
          id?: string
          job_position_id?: string | null
          kuwaitization_target_pct?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          budgeted_headcount?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id?: string | null
          fiscal_year?: number
          id?: string
          job_position_id?: string | null
          kuwaitization_target_pct?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_manpower_plan_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_manpower_plan_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_manpower_plan_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "tas_job_position"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_notification: {
        Row: {
          body: string | null
          channel: string
          context_json: Json
          created_at: string
          created_by: string | null
          deep_link: string | null
          error_text: string | null
          id: string
          locale: string
          read_at: string | null
          recipient_user_id: string | null
          retry_count: number
          sent_at: string | null
          source_event_id: string | null
          status: string
          subject: string | null
          type_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          context_json?: Json
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          error_text?: string | null
          id?: string
          locale?: string
          read_at?: string | null
          recipient_user_id?: string | null
          retry_count?: number
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          subject?: string | null
          type_code: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          context_json?: Json
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          error_text?: string | null
          id?: string
          locale?: string
          read_at?: string | null
          recipient_user_id?: string | null
          retry_count?: number
          sent_at?: string | null
          source_event_id?: string | null
          status?: string
          subject?: string | null
          type_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_notification_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_notification_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_event"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_notification_pref: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          is_mandatory: boolean
          type_category: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          type_category: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          is_mandatory?: boolean
          type_category?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_notification_pref_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_notification_template: {
        Row: {
          body_ar: string | null
          body_en: string | null
          channel: string
          created_at: string
          created_by: string | null
          id: string
          status: string
          subject_ar: string | null
          subject_en: string | null
          type_code: string
          updated_at: string
          updated_by: string | null
          variables_json: Json
          version: number
        }
        Insert: {
          body_ar?: string | null
          body_en?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          subject_ar?: string | null
          subject_en?: string | null
          type_code: string
          updated_at?: string
          updated_by?: string | null
          variables_json?: Json
          version?: number
        }
        Update: {
          body_ar?: string | null
          body_en?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          subject_ar?: string | null
          subject_en?: string | null
          type_code?: string
          updated_at?: string
          updated_by?: string | null
          variables_json?: Json
          version?: number
        }
        Relationships: []
      }
      tas_offer: {
        Row: {
          accepted_at: string | null
          application_id: string
          candidate_id: string
          contract_type: string | null
          created_at: string
          created_by: string | null
          currency: string
          declined_reason: string | null
          employment_type: string | null
          esign_status: string
          expiry_date: string | null
          id: string
          job_grade_id: string | null
          job_position_id: string | null
          letter_snapshot_json: Json
          letter_template_id: string | null
          onboarding_ready: boolean
          probation_months: number | null
          reference: string | null
          salary_amount: number | null
          salary_components_json: Json
          start_date: string | null
          status: string
          terms_ar: string | null
          terms_en: string | null
          updated_at: string
          updated_by: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          application_id: string
          candidate_id: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declined_reason?: string | null
          employment_type?: string | null
          esign_status?: string
          expiry_date?: string | null
          id?: string
          job_grade_id?: string | null
          job_position_id?: string | null
          letter_snapshot_json?: Json
          letter_template_id?: string | null
          onboarding_ready?: boolean
          probation_months?: number | null
          reference?: string | null
          salary_amount?: number | null
          salary_components_json?: Json
          start_date?: string | null
          status?: string
          terms_ar?: string | null
          terms_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          application_id?: string
          candidate_id?: string
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          declined_reason?: string | null
          employment_type?: string | null
          esign_status?: string
          expiry_date?: string | null
          id?: string
          job_grade_id?: string | null
          job_position_id?: string | null
          letter_snapshot_json?: Json
          letter_template_id?: string | null
          onboarding_ready?: boolean
          probation_months?: number | null
          reference?: string | null
          salary_amount?: number | null
          salary_components_json?: Json
          start_date?: string | null
          status?: string
          terms_ar?: string | null
          terms_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_offer_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_job_grade_id_fkey"
            columns: ["job_grade_id"]
            isOneToOne: false
            referencedRelation: "tas_job_grade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "tas_job_position"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_offer_counter: {
        Row: {
          fiscal_year: number
          last_no: number
        }
        Insert: {
          fiscal_year: number
          last_no?: number
        }
        Update: {
          fiscal_year?: number
          last_no?: number
        }
        Relationships: []
      }
      tas_offer_event: {
        Row: {
          actor_user_id: string | null
          created_at: string
          detail_json: Json
          event_type: string | null
          from_status: string | null
          id: string
          offer_id: string
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          event_type?: string | null
          from_status?: string | null
          id?: string
          offer_id: string
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          event_type?: string | null
          from_status?: string | null
          id?: string
          offer_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_offer_event_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_offer_event_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "tas_offer"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_onboarding: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          created_at: string
          created_by: string | null
          handed_off_at: string | null
          handoff_payload: Json
          handoff_status: string
          id: string
          mename_employee_ref: string | null
          notes: string | null
          preboarding_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          handed_off_at?: string | null
          handoff_payload?: Json
          handoff_status?: string
          id?: string
          mename_employee_ref?: string | null
          notes?: string | null
          preboarding_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          created_at?: string
          created_by?: string | null
          handed_off_at?: string | null
          handoff_payload?: Json
          handoff_status?: string
          id?: string
          mename_employee_ref?: string | null
          notes?: string | null
          preboarding_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_onboarding_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_onboarding_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_onboarding_preboarding_id_fkey"
            columns: ["preboarding_id"]
            isOneToOne: true
            referencedRelation: "tas_preboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_permission: {
        Row: {
          action: string | null
          area: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_system: boolean
          key: string | null
          module_code: string | null
          name_ar: string | null
          name_en: string | null
        }
        Insert: {
          action?: string | null
          area?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_system?: boolean
          key?: string | null
          module_code?: string | null
          name_ar?: string | null
          name_en?: string | null
        }
        Update: {
          action?: string | null
          area?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_system?: boolean
          key?: string | null
          module_code?: string | null
          name_ar?: string | null
          name_en?: string | null
        }
        Relationships: []
      }
      tas_pipeline_stage: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_terminal: boolean
          name_ar: string
          name_en: string
          sort_order: number
          stage_type: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_terminal?: boolean
          name_ar: string
          name_en: string
          sort_order?: number
          stage_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_terminal?: boolean
          name_ar?: string
          name_en?: string
          sort_order?: number
          stage_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_preboarding: {
        Row: {
          application_id: string
          candidate_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          offer_id: string | null
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          candidate_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          candidate_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          offer_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_preboarding_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_preboarding_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_preboarding_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_preboarding_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "tas_offer"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_preboarding_item: {
        Row: {
          collected_at: string | null
          created_at: string
          created_by: string | null
          doc_category: string
          document_id: string | null
          id: string
          label_ar: string | null
          label_en: string | null
          preboarding_id: string
          required: boolean
          status: string
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          waived_reason: string | null
        }
        Insert: {
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          doc_category: string
          document_id?: string | null
          id?: string
          label_ar?: string | null
          label_en?: string | null
          preboarding_id: string
          required?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          waived_reason?: string | null
        }
        Update: {
          collected_at?: string | null
          created_at?: string
          created_by?: string | null
          doc_category?: string
          document_id?: string | null
          id?: string
          label_ar?: string | null
          label_en?: string | null
          preboarding_id?: string
          required?: boolean
          status?: string
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          waived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_preboarding_item_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "tas_document"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_preboarding_item_preboarding_id_fkey"
            columns: ["preboarding_id"]
            isOneToOne: false
            referencedRelation: "tas_preboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_requisition: {
        Row: {
          branch_id: string | null
          budgeted_position_id: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          employment_type: string | null
          entity_id: string
          headcount: number
          id: string
          jd_snapshot_json: Json
          jd_template_id: string | null
          job_position_id: string
          justification_en: string | null
          reference: string | null
          requested_by: string | null
          salary_max: number | null
          salary_min: number | null
          status: string
          target_start_date: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
          updated_by: string | null
          workflow_instance_id: string | null
        }
        Insert: {
          branch_id?: string | null
          budgeted_position_id?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: string | null
          entity_id: string
          headcount?: number
          id?: string
          jd_snapshot_json?: Json
          jd_template_id?: string | null
          job_position_id: string
          justification_en?: string | null
          reference?: string | null
          requested_by?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          target_start_date?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_instance_id?: string | null
        }
        Update: {
          branch_id?: string | null
          budgeted_position_id?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          employment_type?: string | null
          entity_id?: string
          headcount?: number
          id?: string
          jd_snapshot_json?: Json
          jd_template_id?: string | null
          job_position_id?: string
          justification_en?: string | null
          reference?: string | null
          requested_by?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          target_start_date?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          updated_by?: string | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_requisition_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_budgeted_position_id_fkey"
            columns: ["budgeted_position_id"]
            isOneToOne: false
            referencedRelation: "tas_budgeted_position"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_jd_template_id_fkey"
            columns: ["jd_template_id"]
            isOneToOne: false
            referencedRelation: "tas_jd_template"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_job_position_id_fkey"
            columns: ["job_position_id"]
            isOneToOne: false
            referencedRelation: "tas_job_position"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_workflow_instance_id_fkey"
            columns: ["workflow_instance_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_requisition_counter: {
        Row: {
          fiscal_year: number
          last_no: number
        }
        Insert: {
          fiscal_year: number
          last_no?: number
        }
        Update: {
          fiscal_year?: number
          last_no?: number
        }
        Relationships: []
      }
      tas_requisition_event: {
        Row: {
          actor_user_id: string | null
          created_at: string
          detail_json: Json
          event_type: string | null
          from_status: string | null
          id: string
          requisition_id: string
          to_status: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          event_type?: string | null
          from_status?: string | null
          id?: string
          requisition_id: string
          to_status?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          detail_json?: Json
          event_type?: string | null
          from_status?: string | null
          id?: string
          requisition_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_requisition_event_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_requisition_event_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "tas_requisition"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_role: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_system: boolean
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_system?: boolean
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_system?: boolean
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_role_permission: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_role_permission_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "tas_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_role_permission_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tas_role"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_screening: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          id: string
          notes_en: string | null
          overall_score: number | null
          recommendation: string | null
          scorecard_id: string | null
          screened_at: string
          screened_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes_en?: string | null
          overall_score?: number | null
          recommendation?: string | null
          scorecard_id?: string | null
          screened_at?: string
          screened_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes_en?: string | null
          overall_score?: number | null
          recommendation?: string | null
          scorecard_id?: string | null
          screened_at?: string
          screened_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_screening_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "tas_application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_screening_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_scorecard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_screening_screened_by_fkey"
            columns: ["screened_by"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_screening_criterion: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          max_score: number
          name_ar: string
          name_en: string
          scorecard_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_score?: number
          name_ar: string
          name_en: string
          scorecard_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_score?: number
          name_ar?: string
          name_en?: string
          scorecard_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tas_screening_criterion_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_scorecard"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_screening_score: {
        Row: {
          criterion_id: string
          id: string
          note: string | null
          score: number | null
          screening_id: string
        }
        Insert: {
          criterion_id: string
          id?: string
          note?: string | null
          score?: number | null
          screening_id: string
        }
        Update: {
          criterion_id?: string
          id?: string
          note?: string | null
          score?: number | null
          screening_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_screening_score_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "tas_screening_criterion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_screening_score_screening_id_fkey"
            columns: ["screening_id"]
            isOneToOne: false
            referencedRelation: "tas_screening"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_screening_scorecard: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_session: {
        Row: {
          expires_at: string | null
          id: string
          ip: string | null
          issued_at: string
          last_seen_at: string | null
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          ip?: string | null
          issued_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          ip?: string | null
          issued_at?: string
          last_seen_at?: string | null
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_session_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_storage_adapter_config: {
        Row: {
          config_status: string
          created_at: string
          created_by: string | null
          id: string
          is_enabled: boolean
          notes: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_enabled?: boolean
          notes?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_system_setting: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value_json: Json
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_json?: Json
        }
        Relationships: []
      }
      tas_talent_pool: {
        Row: {
          agency_name: string | null
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          pool_status: string
          referred_by: string | null
          source_channel: string
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_name?: string | null
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pool_status?: string
          referred_by?: string | null
          source_channel?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_name?: string | null
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          pool_status?: string
          referred_by?: string | null
          source_channel?: string
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_talent_pool_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "tas_candidate"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_user: {
        Row: {
          created_at: string
          created_by: string | null
          default_locale: string
          display_name_ar: string | null
          display_name_en: string | null
          email: string
          entra_object_id: string | null
          id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_locale?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          email: string
          entra_object_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_locale?: string
          display_name_ar?: string | null
          display_name_en?: string | null
          email?: string
          entra_object_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      tas_user_role: {
        Row: {
          created_at: string
          created_by: string | null
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tas_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_user_role_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_user_scope: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          entity_id: string
          id: string
          is_crossdept_readonly: boolean
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id: string
          id?: string
          is_crossdept_readonly?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          entity_id?: string
          id?: string
          is_crossdept_readonly?: boolean
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tas_user_scope_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_user_scope_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_user_scope_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_user_scope_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_workflow_definition: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name_ar: string
          name_en: string
          request_type: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar: string
          name_en: string
          request_type: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          request_type?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      tas_workflow_event: {
        Row: {
          consumed: boolean
          created_at: string
          event_type: string
          id: string
          instance_id: string
          payload_json: Json
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          event_type: string
          id?: string
          instance_id: string
          payload_json?: Json
        }
        Update: {
          consumed?: boolean
          created_at?: string
          event_type?: string
          id?: string
          instance_id?: string
          payload_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tas_workflow_event_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_workflow_history: {
        Row: {
          action: string | null
          actor_user_id: string | null
          comment: string | null
          created_at: string
          from_status: string | null
          id: string
          instance_id: string
          step_no: number | null
          to_status: string | null
        }
        Insert: {
          action?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          instance_id: string
          step_no?: number | null
          to_status?: string | null
        }
        Update: {
          action?: string | null
          actor_user_id?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          instance_id?: string
          step_no?: number | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_workflow_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_history_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_instance"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_workflow_instance: {
        Row: {
          branch_id: string | null
          context_json: Json
          created_at: string
          created_by: string | null
          current_step: number
          definition_id: string
          department_id: string | null
          entity_id: string | null
          id: string
          request_ref: string | null
          request_type: string
          requester_user_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          context_json?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          definition_id: string
          department_id?: string | null
          entity_id?: string | null
          id?: string
          request_ref?: string | null
          request_type: string
          requester_user_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          context_json?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          definition_id?: string
          department_id?: string | null
          entity_id?: string | null
          id?: string
          request_ref?: string | null
          request_type?: string
          requester_user_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_workflow_instance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_instance_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_definition"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_instance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "tas_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_instance_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "tas_entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_instance_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_workflow_step: {
        Row: {
          approver_rule_type: string
          approver_rule_value: Json
          condition_json: Json | null
          created_at: string
          created_by: string | null
          definition_id: string
          id: string
          name_ar: string
          name_en: string
          on_reject: string
          quorum: number
          sla_hours: number | null
          step_no: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver_rule_type: string
          approver_rule_value?: Json
          condition_json?: Json | null
          created_at?: string
          created_by?: string | null
          definition_id: string
          id?: string
          name_ar: string
          name_en: string
          on_reject?: string
          quorum?: number
          sla_hours?: number | null
          step_no: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver_rule_type?: string
          approver_rule_value?: Json
          condition_json?: Json | null
          created_at?: string
          created_by?: string | null
          definition_id?: string
          id?: string
          name_ar?: string
          name_en?: string
          on_reject?: string
          quorum?: number
          sla_hours?: number | null
          step_no?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_workflow_step_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_definition"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_workflow_task: {
        Row: {
          acted_at: string | null
          assignee_user_id: string | null
          created_at: string
          created_by: string | null
          decision_comment_ar: string | null
          decision_comment_en: string | null
          due_at: string | null
          id: string
          instance_id: string
          resolved_via: string
          status: string
          step_no: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acted_at?: string | null
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_comment_ar?: string | null
          decision_comment_en?: string | null
          due_at?: string | null
          id?: string
          instance_id: string
          resolved_via?: string
          status?: string
          step_no: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acted_at?: string | null
          assignee_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_comment_ar?: string | null
          decision_comment_en?: string | null
          due_at?: string | null
          id?: string
          instance_id?: string
          resolved_via?: string
          status?: string
          step_no?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tas_workflow_task_assignee_user_id_fkey"
            columns: ["assignee_user_id"]
            isOneToOne: false
            referencedRelation: "tas_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tas_workflow_task_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "tas_workflow_instance"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_audit_unified: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          detail_json: Json | null
          entity_ref: string | null
          entity_type: string | null
          event_type: string | null
          id: string | null
          ip: string | null
          module_code: string | null
          source: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _active_admin_count: { Args: never; Returns: number }
      _admin_caller_id: { Args: never; Returns: string }
      _caller_permissions: { Args: never; Returns: string[] }
      _has_permission: { Args: { p_key: string }; Returns: boolean }
      _is_system_admin: { Args: never; Returns: boolean }
      _wf_advance: {
        Args: { p_actor: string; p_from_step: number; p_instance: string }
        Returns: undefined
      }
      _wf_apply_delegation: {
        Args: { p_request_type: string; p_user: string }
        Returns: {
          final_uid: string
          via: string
        }[]
      }
      _wf_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_instance: string
          p_step: number
        }
        Returns: undefined
      }
      _wf_enter_step: {
        Args: { p_instance: string; p_step_no: number }
        Returns: number
      }
      act_on_task: {
        Args: {
          p_action: string
          p_comment?: string
          p_comment_ar?: string
          p_target?: string
          p_task_id: string
        }
        Returns: undefined
      }
      activate_workflow: {
        Args: { p_definition_id: string }
        Returns: undefined
      }
      add_to_talent_pool: {
        Args: {
          p_agency?: string
          p_candidate_id: string
          p_channel?: string
          p_notes?: string
          p_referred_by?: string
          p_tags?: Json
        }
        Returns: string
      }
      admin_assign_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_assign_scope: {
        Args: {
          p_branch_id?: string
          p_department_id?: string
          p_entity_id: string
          p_user_id: string
        }
        Returns: string
      }
      admin_get_user: { Args: { p_user_id: string }; Returns: Json }
      admin_list_roles: { Args: never; Returns: Json }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_remove_role: {
        Args: { p_role_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_remove_scope: { Args: { p_scope_id: string }; Returns: undefined }
      admin_set_user_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
      admin_upsert_user: {
        Args: {
          p_default_locale?: string
          p_display_name_ar?: string
          p_display_name_en?: string
          p_email?: string
          p_id?: string
          p_status?: string
        }
        Returns: string
      }
      ai_generate_jd: {
        Args: { p_notes?: string; p_title: string }
        Returns: Json
      }
      ai_status: { Args: never; Returns: Json }
      application_detail: { Args: { p_id: string }; Returns: Json }
      archive_document: { Args: { p_id: string }; Returns: undefined }
      assessment_detail: { Args: { p_id: string }; Returns: Json }
      audit_log: {
        Args: {
          p_actor: string
          p_detail: Json
          p_entity_ref: string
          p_entity_type: string
          p_event_type: string
          p_module: string
        }
        Returns: string
      }
      audit_report: {
        Args: { p_limit?: number; p_module?: string; p_offset?: number }
        Returns: {
          actor_name: string
          created_at: string
          entity_ref: string
          entity_type: string
          event_type: string
          id: string
          module_code: string
        }[]
      }
      audit_stats: { Args: never; Returns: Json }
      cancel_interview: {
        Args: { p_interview_id: string; p_reason?: string }
        Returns: undefined
      }
      check_budgeted_position: {
        Args: {
          p_department_id: string
          p_headcount: number
          p_job_position_id: string
        }
        Returns: {
          available: number
          budgeted: number
          filled: number
          over_budget: boolean
        }[]
      }
      complete_onboarding: {
        Args: { p_mename_ref?: string; p_onboarding_id: string }
        Returns: undefined
      }
      complete_preboarding: {
        Args: { p_preboarding_id: string }
        Returns: undefined
      }
      config_attach_competency: {
        Args: {
          p_competency_id: string
          p_jd_template_id: string
          p_proficiency_level?: number
        }
        Returns: undefined
      }
      config_delete_lookup: { Args: { p_id: string }; Returns: undefined }
      config_detach_competency: {
        Args: { p_competency_id: string; p_jd_template_id: string }
        Returns: undefined
      }
      config_save_jd_sections: {
        Args: { p_jd_template_id: string; p_sections: Json }
        Returns: undefined
      }
      config_upsert_branch: {
        Args: {
          p_address_ar?: string
          p_address_en?: string
          p_code?: string
          p_entity_id?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_paci_area?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_criterion: {
        Args: {
          p_code?: string
          p_id?: string
          p_max_score?: number
          p_name_ar?: string
          p_name_en?: string
          p_scorecard_id?: string
          p_sort_order?: number
          p_weight?: number
        }
        Returns: string
      }
      config_upsert_department: {
        Args: {
          p_branch_id?: string
          p_code?: string
          p_function_code?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_parent_department_id?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_entity: {
        Args: {
          p_code?: string
          p_commercial_reg_no?: string
          p_id?: string
          p_kuwaitization_target_pct?: number
          p_name_ar?: string
          p_name_en?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_jd_template: {
        Args: {
          p_code?: string
          p_id?: string
          p_job_position_id?: string
          p_status?: string
          p_summary_ar?: string
          p_summary_en?: string
          p_title_ar?: string
          p_title_en?: string
          p_version?: number
        }
        Returns: string
      }
      config_upsert_job_family: {
        Args: {
          p_code?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_job_grade: {
        Args: {
          p_code?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_rank?: number
          p_status?: string
        }
        Returns: string
      }
      config_upsert_job_position: {
        Args: {
          p_code?: string
          p_id?: string
          p_is_kuwaitization_targeted?: boolean
          p_job_family_id?: string
          p_job_grade_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_lookup: {
        Args: {
          p_code?: string
          p_id?: string
          p_lookup_type?: string
          p_name_ar?: string
          p_name_en?: string
          p_sort_order?: number
          p_status?: string
        }
        Returns: string
      }
      config_upsert_pipeline_stage: {
        Args: {
          p_code?: string
          p_id?: string
          p_is_terminal?: boolean
          p_name_ar?: string
          p_name_en?: string
          p_sort_order?: number
          p_stage_type?: string
          p_status?: string
        }
        Returns: string
      }
      config_upsert_scorecard: {
        Args: {
          p_code?: string
          p_description_ar?: string
          p_description_en?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
          p_status?: string
        }
        Returns: string
      }
      create_application: {
        Args: {
          p_candidate_id: string
          p_requisition_id: string
          p_source?: string
        }
        Returns: string
      }
      create_assessment: {
        Args: { p_application_id: string; p_title?: string; p_type?: string }
        Returns: string
      }
      create_screening: {
        Args: { p_application_id: string; p_scorecard_id?: string }
        Returns: string
      }
      current_user_roles: {
        Args: never
        Returns: {
          name_ar: string
          name_en: string
          role_code: string
        }[]
      }
      current_user_scopes: {
        Args: never
        Returns: {
          branch_id: string
          department_id: string
          entity_id: string
          is_crossdept_readonly: boolean
        }[]
      }
      document_versions: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          file_name: string
          id: string
          status: string
          supersedes_id: string
          title: string
          version: number
        }[]
      }
      eval_condition: {
        Args: { p_condition: Json; p_context: Json }
        Returns: boolean
      }
      generate_application_ref: { Args: never; Returns: string }
      generate_interview_ref: { Args: never; Returns: string }
      generate_offer_ref: { Args: never; Returns: string }
      generate_requisition_ref: { Args: never; Returns: string }
      handoff_to_mename: { Args: { p_onboarding_id: string }; Returns: Json }
      instance_timeline: { Args: { p_instance_id: string }; Returns: Json }
      interview_detail: { Args: { p_id: string }; Returns: Json }
      interview_panel_summary: {
        Args: { p_interview_id: string }
        Returns: Json
      }
      issue_offer: { Args: { p_offer_id: string }; Returns: undefined }
      list_adapters: { Args: never; Returns: Json }
      list_applications: {
        Args: {
          p_candidate_search?: string
          p_limit?: number
          p_mine?: boolean
          p_offset?: number
          p_requisition_id?: string
          p_stage_id?: string
          p_status?: string
        }
        Returns: {
          applied_at: string
          candidate_id: string
          candidate_name_ar: string
          candidate_name_en: string
          created_at: string
          current_stage_id: string
          id: string
          owner_user_id: string
          reference: string
          requisition_id: string
          requisition_reference: string
          stage_name_ar: string
          stage_name_en: string
          stage_type: string
          status: string
        }[]
      }
      list_assessments: {
        Args: { p_application_id?: string; p_limit?: number; p_offset?: number }
        Returns: {
          application_id: string
          assessment_type: string
          created_at: string
          id: string
          overall_score: number
          recommendation: string
          status: string
          title: string
        }[]
      }
      list_candidate_consents: {
        Args: { p_candidate_id: string }
        Returns: Json
      }
      list_documents: {
        Args: { p_entity_ref: string; p_entity_type: string }
        Returns: {
          category: string
          created_at: string
          file_name: string
          id: string
          linked_entity_ref: string
          linked_entity_type: string
          mime_type: string
          size_bytes: number
          status: string
          storage_provider: string
          storage_ref: string
          supersedes_id: string
          title: string
          uploaded_by: string
          version: number
        }[]
      }
      list_interviews: {
        Args: {
          p_application_id?: string
          p_from?: string
          p_limit?: number
          p_mine?: boolean
          p_offset?: number
          p_status?: string
          p_to?: string
        }
        Returns: {
          application_id: string
          application_ref: string
          calendar_status: string
          candidate_name_ar: string
          candidate_name_en: string
          duration_min: number
          id: string
          location: string
          mode: string
          outcome: string
          reference: string
          round_type: string
          scheduled_at: string
          status: string
          teams_join_url: string
        }[]
      }
      list_manpower_plans: {
        Args: { p_fiscal_year?: number; p_limit?: number; p_offset?: number }
        Returns: {
          budgeted_headcount: number
          department_id: string
          entity_id: string
          fiscal_year: number
          id: string
          job_position_id: string
          kuwaitization_target_pct: number
          open_requisitions: number
          status: string
        }[]
      }
      list_offers: {
        Args: {
          p_application_id?: string
          p_candidate_id?: string
          p_limit?: number
          p_mine?: boolean
          p_offset?: number
          p_status?: string
        }
        Returns: {
          application_id: string
          candidate_id: string
          candidate_name_ar: string
          candidate_name_en: string
          created_at: string
          currency: string
          esign_status: string
          id: string
          onboarding_ready: boolean
          reference: string
          salary_amount: number
          status: string
        }[]
      }
      list_onboarding: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          application_id: string
          candidate_id: string
          candidate_name_ar: string
          candidate_name_en: string
          created_at: string
          handoff_status: string
          id: string
          mename_employee_ref: string
          reference: string
          status: string
        }[]
      }
      list_pipeline_stages: {
        Args: never
        Returns: {
          code: string
          id: string
          is_terminal: boolean
          name_ar: string
          name_en: string
          sort_order: number
          stage_type: string
          status: string
        }[]
      }
      list_preboarding: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: {
          application_id: string
          candidate_id: string
          candidate_name_ar: string
          candidate_name_en: string
          id: string
          reference: string
          required_done: number
          required_total: number
          started_at: string
          status: string
        }[]
      }
      list_public_jobs: {
        Args: never
        Returns: {
          created_at: string
          department_ar: string
          department_en: string
          employment_type: string
          id: string
          reference: string
          title_ar: string
          title_en: string
        }[]
      }
      list_requisitions: {
        Args: {
          p_department_id?: string
          p_from?: string
          p_limit?: number
          p_mine?: boolean
          p_offset?: number
          p_position_id?: string
          p_status?: string
          p_to?: string
        }
        Returns: {
          created_at: string
          department_id: string
          headcount: number
          id: string
          job_position_id: string
          reference: string
          requested_by: string
          status: string
          title_ar: string
          title_en: string
          workflow_instance_id: string
        }[]
      }
      list_screening_scorecards: { Args: never; Returns: Json }
      list_system_settings: { Args: never; Returns: Json }
      list_talent_pool: {
        Args: {
          p_channel?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: {
          agency_name: string
          candidate_id: string
          candidate_name_ar: string
          candidate_name_en: string
          created_at: string
          email: string
          id: string
          pool_status: string
          source_channel: string
          tags: string[]
        }[]
      }
      m365_status: { Args: never; Returns: Json }
      manpower_plan_detail: { Args: { p_id: string }; Returns: Json }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
      mename_status: { Args: never; Returns: Json }
      mename_test_connection: { Args: never; Returns: Json }
      move_application_stage: {
        Args: {
          p_application_id: string
          p_note?: string
          p_to_stage_id: string
        }
        Returns: undefined
      }
      my_capabilities: { Args: never; Returns: string[] }
      my_notifications: {
        Args: { p_unread_only?: boolean; p_user_id: string }
        Returns: {
          body: string
          created_at: string
          deep_link: string
          id: string
          locale: string
          read_at: string
          subject: string
          type_code: string
        }[]
      }
      my_pending_tasks: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          due_at: string
          instance_id: string
          instance_status: string
          request_ref: string
          request_type: string
          resolved_via: string
          step_no: number
          task_id: string
        }[]
      }
      notify: {
        Args: {
          p_context: Json
          p_deep_link?: string
          p_recipient_ids: string[]
          p_type_code: string
        }
        Returns: number
      }
      offer_detail: { Args: { p_id: string }; Returns: Json }
      onboarding_detail: { Args: { p_id: string }; Returns: Json }
      perm_list_catalog: { Args: never; Returns: Json }
      preboarding_detail: { Args: { p_id: string }; Returns: Json }
      preview_template: {
        Args: { p_sample_context: Json; p_template_id: string }
        Returns: {
          body: string
          subject: string
        }[]
      }
      public_job_detail: { Args: { p_id: string }; Returns: Json }
      record_consent: {
        Args: {
          p_candidate_id: string
          p_granted: boolean
          p_notes?: string
          p_retention_until?: string
          p_source?: string
          p_type: string
        }
        Returns: string
      }
      record_interview_outcome: {
        Args: { p_interview_id: string; p_outcome: string }
        Returns: Json
      }
      recruitment_kpis: { Args: never; Returns: Json }
      render_template: {
        Args: {
          p_channel: string
          p_context: Json
          p_locale: string
          p_type_code: string
        }
        Returns: {
          body: string
          subject: string
        }[]
      }
      requisition_detail: { Args: { p_id: string }; Returns: Json }
      reschedule_interview: {
        Args: { p_interview_id: string; p_new_datetime: string }
        Returns: undefined
      }
      resolve_current_user: {
        Args: never
        Returns: {
          default_locale: string
          display_name_ar: string
          display_name_en: string
          email: string
          id: string
          status: string
        }[]
      }
      resolve_step_approvers: {
        Args: { p_instance_id: string; p_step_no: number }
        Returns: {
          resolved_via: string
          user_id: string
        }[]
      }
      respond_to_offer: {
        Args: {
          p_decision: string
          p_offer_id: string
          p_reason?: string
          p_signature?: string
        }
        Returns: Json
      }
      retry_notification: { Args: { p_id: string }; Returns: undefined }
      role_delete: { Args: { p_role_id: string }; Returns: undefined }
      role_upsert: {
        Args: {
          p_code?: string
          p_description_ar?: string
          p_description_en?: string
          p_id?: string
          p_name_ar?: string
          p_name_en?: string
        }
        Returns: string
      }
      roleperm_grant: {
        Args: { p_permission_id: string; p_role_id: string }
        Returns: undefined
      }
      roleperm_list_matrix: { Args: never; Returns: Json }
      roleperm_revoke: {
        Args: { p_permission_id: string; p_role_id: string }
        Returns: undefined
      }
      save_assessment_items: {
        Args: { p_assessment_id: string; p_items: Json }
        Returns: number
      }
      save_screening_scores: {
        Args: { p_scores: Json; p_screening_id: string }
        Returns: number
      }
      schedule_interview: {
        Args: {
          p_application_id: string
          p_duration_min: number
          p_location: string
          p_mode: string
          p_panelist_ids: string[]
          p_round_type: string
          p_scheduled_at: string
          p_scorecard_id?: string
        }
        Returns: string
      }
      screening_detail: { Args: { p_application_id: string }; Returns: Json }
      search_audit: {
        Args: {
          p_actor?: string
          p_entity_ref?: string
          p_entity_type?: string
          p_event_type?: string
          p_from?: string
          p_limit?: number
          p_module?: string
          p_offset?: number
          p_to?: string
        }
        Returns: {
          actor_user_id: string
          created_at: string
          detail_json: Json
          entity_ref: string
          entity_type: string
          event_type: string
          id: string
          ip: string
          module_code: string
          source: string
        }[]
      }
      set_adapter_enabled: {
        Args: { p_enabled: boolean; p_kind: string; p_provider: string }
        Returns: undefined
      }
      set_application_status: {
        Args: { p_application_id: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      set_manpower_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      set_preboarding_item: {
        Args: {
          p_document_id?: string
          p_item_id: string
          p_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      set_system_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      start_onboarding: { Args: { p_preboarding_id: string }; Returns: string }
      start_preboarding: { Args: { p_application_id: string }; Returns: string }
      submit_assessment: {
        Args: {
          p_assessment_id: string
          p_notes?: string
          p_recommendation: string
        }
        Returns: undefined
      }
      submit_interview_score: {
        Args: {
          p_interview_id: string
          p_notes_en?: string
          p_recommendation?: string
          p_scores: Json
        }
        Returns: number
      }
      submit_offer: { Args: { p_offer_id: string }; Returns: string }
      submit_public_application: {
        Args: {
          p_cover?: string
          p_email: string
          p_full_name: string
          p_job_id: string
          p_nationality?: string
          p_phone?: string
        }
        Returns: Json
      }
      submit_requisition: {
        Args: { p_requisition_id: string }
        Returns: string
      }
      submit_screening: {
        Args: {
          p_notes_en?: string
          p_recommendation: string
          p_screening_id: string
        }
        Returns: Json
      }
      submit_workflow: {
        Args: {
          p_branch_id: string
          p_context_json: Json
          p_department_id: string
          p_entity_id: string
          p_request_ref: string
          p_request_type: string
          p_requester_id: string
        }
        Returns: string
      }
      sync_offer_status: { Args: { p_offer_id: string }; Returns: string }
      sync_requisition_status: {
        Args: { p_requisition_id: string }
        Returns: string
      }
      transition_offer: {
        Args: { p_action: string; p_offer_id: string }
        Returns: undefined
      }
      transition_requisition: {
        Args: { p_action: string; p_requisition_id: string }
        Returns: undefined
      }
      unread_count: { Args: { p_user_id: string }; Returns: number }
      update_pool_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      upsert_candidate: {
        Args: {
          p_current_title?: string
          p_email?: string
          p_first_name?: string
          p_full_name_ar?: string
          p_full_name_en?: string
          p_id?: string
          p_last_name?: string
          p_nationality?: string
          p_nationality_class?: string
          p_phone?: string
          p_source?: string
        }
        Returns: string
      }
      upsert_manpower_plan: {
        Args: {
          p_budgeted?: number
          p_department_id?: string
          p_entity_id?: string
          p_fiscal_year?: number
          p_id?: string
          p_job_position_id?: string
          p_kuwait_pct?: number
          p_notes?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
