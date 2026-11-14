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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      annotations: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          page_number: number
          publication_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          page_number: number
          publication_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          page_number?: number
          publication_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_audit_log: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          is_admin: boolean | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          is_admin?: boolean | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          is_admin?: boolean | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          biography: string | null
          created_at: string
          id: string
          name: string
          photo_url: string | null
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          biography?: string | null
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          biography?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          certificate_pdf_url: string | null
          created_at: string
          id: string
          issued_at: string
          issued_by: string
          publication_author: string
          publication_category: string
          publication_date: string
          publication_id: string
          publication_number: string
          publication_title: string
          qr_code_url: string | null
          status: string
          updated_at: string
          verification_url: string
        }
        Insert: {
          certificate_number: string
          certificate_pdf_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by: string
          publication_author: string
          publication_category: string
          publication_date: string
          publication_id: string
          publication_number: string
          publication_title: string
          qr_code_url?: string | null
          status?: string
          updated_at?: string
          verification_url: string
        }
        Update: {
          certificate_number?: string
          certificate_pdf_url?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string
          publication_author?: string
          publication_category?: string
          publication_date?: string
          publication_id?: string
          publication_number?: string
          publication_title?: string
          qr_code_url?: string | null
          status?: string
          updated_at?: string
          verification_url?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          publication_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          publication_id: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          publication_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          publication_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          publication_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          publication_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      publications: {
        Row: {
          access_level: string
          allow_download: boolean
          author: string
          category: Database["public"]["Enums"]["content_category"]
          certification_status: Database["public"]["Enums"]["certification_status"]
          cover_image_url: string | null
          created_at: string
          description: string | null
          downloads_count: number
          file_url: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          premium_file_path: string | null
          publication_number: string | null
          summary: string | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          access_level?: string
          premium_file_path?: string | null
          allow_download?: boolean
          author: string
          category: Database["public"]["Enums"]["content_category"]
          certification_status?: Database["public"]["Enums"]["certification_status"]
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          downloads_count?: number
          file_url?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          publication_number?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          access_level?: string
          premium_file_path?: string | null
          allow_download?: boolean
          author?: string
          category?: Database["public"]["Enums"]["content_category"]
          certification_status?: Database["public"]["Enums"]["certification_status"]
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          downloads_count?: number
          file_url?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          publication_number?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          event_id: string
          event_type: string | null
          id: string
          payload: Json | null
          payment_provider: string
          processed_at: string | null
          processing_error: string | null
          received_at: string
          signature_valid: boolean | null
        }
        Insert: {
          event_id: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          payment_provider: string
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          signature_valid?: boolean | null
        }
        Update: {
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json | null
          payment_provider?: string
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
          signature_valid?: boolean | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          confirmed_at: string | null
          created_at: string
          currency: string | null
          failure_reason: string | null
          id: string
          payment_provider: string
          plan_id: string | null
          provider_data: Json | null
          provider_reference: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          payment_provider: string
          plan_id?: string | null
          provider_data?: Json | null
          provider_reference: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          currency?: string | null
          failure_reason?: string | null
          id?: string
          payment_provider?: string
          plan_id?: string | null
          provider_data?: Json | null
          provider_reference?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          google_play_base_plan_id: string | null
          google_play_product_id: string | null
          id: string
          is_active: boolean
          name: string
          price_amount: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days: number
          google_play_base_plan_id?: string | null
          google_play_product_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_amount?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          google_play_base_plan_id?: string | null
          google_play_product_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_amount?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_reminders: {
        Row: {
          channels: string[]
          error: string | null
          expires_at: string
          id: string
          kind: string
          notification_id: string | null
          sent_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          error?: string | null
          expires_at: string
          id?: string
          kind: string
          notification_id?: string | null
          sent_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          error?: string | null
          expires_at?: string
          id?: string
          kind?: string
          notification_id?: string | null
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          payment_provider: string
          plan_id: string | null
          provider_reference: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_provider: string
          plan_id?: string | null
          provider_reference?: string | null
          started_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_provider?: string
          plan_id?: string | null
          provider_reference?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_history: {
        Row: {
          created_at: string
          id: string
          last_page_read: number | null
          publication_id: string
          reading_duration_seconds: number
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_page_read?: number | null
          publication_id: string
          reading_duration_seconds?: number
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_page_read?: number | null
          publication_id?: string
          reading_duration_seconds?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          key: string
          label: string
          updated_at?: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          academic_year: string
          admin_note: string | null
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          faculty: string
          file_url: string | null
          id: string
          status: string
          student_name: string
          title: string
          university: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          admin_note?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          faculty: string
          file_url?: string | null
          id?: string
          status?: string
          student_name: string
          title: string
          university: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          admin_note?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          faculty?: string
          file_url?: string | null
          id?: string
          status?: string
          student_name?: string
          title?: string
          university?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          subscription_type: Database["public"]["Enums"]["subscription_type"]
          subscription_updated_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          subscription_type?: Database["public"]["Enums"]["subscription_type"]
          subscription_updated_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          subscription_type?: Database["public"]["Enums"]["subscription_type"]
          subscription_updated_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_grant_premium: {
        Args: { _days?: number | null; _note?: string | null; _user_id: string }
        Returns: Database["public"]["Tables"]["subscriptions"]["Row"]
      }
      admin_revoke_premium: {
        Args: { _note?: string | null; _user_id: string }
        Returns: number
      }
      premium_expires_at: { Args: { _user_id: string }; Returns: string | null }
      user_has_premium: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_downloads: {
        Args: { publication_id: string }
        Returns: undefined
      }
      increment_views: { Args: { publication_id: string }; Returns: undefined }
      is_premium: { Args: { _user_id: string }; Returns: boolean }
      next_certificate_number: { Args: { _category?: string }; Returns: string }
      next_publication_number: { Args: { _category: string }; Returns: string }
    }
    Enums: {
      app_role: "admin"
      certification_status: "not_certified" | "pending" | "certified"
      content_category: "livre" | "memoire" | "tfc" | "article"
      subscription_type: "free" | "premium"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      certification_status: ["not_certified", "pending", "certified"],
      content_category: ["livre", "memoire", "tfc", "article"],
      subscription_type: ["free", "premium"],
    },
  },
} as const
