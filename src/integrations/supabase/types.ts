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
      tas_permission: {
        Row: {
          action: string
          id: string
          module_code: string
          name_ar: string | null
          name_en: string | null
        }
        Insert: {
          action: string
          id?: string
          module_code: string
          name_ar?: string | null
          name_en?: string | null
        }
        Update: {
          action?: string
          id?: string
          module_code?: string
          name_ar?: string | null
          name_en?: string | null
        }
        Relationships: []
      }
      tas_role: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
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
      [_ in never]: never
    }
    Functions: {
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
      eval_condition: {
        Args: { p_condition: Json; p_context: Json }
        Returns: boolean
      }
      instance_timeline: { Args: { p_instance_id: string }; Returns: Json }
      mark_notification_read: { Args: { p_id: string }; Returns: undefined }
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
      preview_template: {
        Args: { p_sample_context: Json; p_template_id: string }
        Returns: {
          body: string
          subject: string
        }[]
      }
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
      resolve_step_approvers: {
        Args: { p_instance_id: string; p_step_no: number }
        Returns: {
          resolved_via: string
          user_id: string
        }[]
      }
      retry_notification: { Args: { p_id: string }; Returns: undefined }
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
      unread_count: { Args: { p_user_id: string }; Returns: number }
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
