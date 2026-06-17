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
          code: string
          created_at: string
          created_by: string | null
          entity_id: string
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
          entity_id: string
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
          entity_id?: string
          id?: string
          name_ar?: string
          name_en?: string
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
          id: string
          name_ar: string
          name_en: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id: string
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
          branch_id?: string
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
        Relationships: [
          {
            foreignKeyName: "tas_department_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "tas_branch"
            referencedColumns: ["id"]
          },
        ]
      }
      tas_entity: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
