export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          id: boolean;
          orchestration_enabled: boolean | null;
          orchestration_url: string | null;
        };
        Insert: {
          id?: boolean;
          orchestration_enabled?: boolean | null;
          orchestration_url?: string | null;
        };
        Update: {
          id?: boolean;
          orchestration_enabled?: boolean | null;
          orchestration_url?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          org_id: string | null;
          resource_id: string | null;
          resource_type: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          org_id?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          org_id?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      business_profiles: {
        Row: {
          address: Json | null;
          business_hours: Json | null;
          description: string | null;
          display_name: string | null;
          languages: string[] | null;
          legal_name: string | null;
          org_id: string;
          updated_at: string | null;
        };
        Insert: {
          address?: Json | null;
          business_hours?: Json | null;
          description?: string | null;
          display_name?: string | null;
          languages?: string[] | null;
          legal_name?: string | null;
          org_id: string;
          updated_at?: string | null;
        };
        Update: {
          address?: Json | null;
          business_hours?: Json | null;
          description?: string | null;
          display_name?: string | null;
          languages?: string[] | null;
          legal_name?: string | null;
          org_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "business_profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      calendly_connections: {
        Row: {
          access_token_secret_ref: string;
          calendly_user_uri: string;
          connected_at: string | null;
          event_type_duration_minutes: number | null;
          event_type_name: string | null;
          event_type_uri: string | null;
          org_id: string;
          organization_uri: string | null;
          owner_email: string | null;
          owner_name: string | null;
          refresh_token_secret_ref: string;
          scheduling_url: string | null;
          status: string;
          timezone: string | null;
          token_expires_at: string;
          updated_at: string | null;
        };
        Insert: {
          access_token_secret_ref: string;
          calendly_user_uri: string;
          connected_at?: string | null;
          event_type_duration_minutes?: number | null;
          event_type_name?: string | null;
          event_type_uri?: string | null;
          org_id: string;
          organization_uri?: string | null;
          owner_email?: string | null;
          owner_name?: string | null;
          refresh_token_secret_ref: string;
          scheduling_url?: string | null;
          status?: string;
          timezone?: string | null;
          token_expires_at: string;
          updated_at?: string | null;
        };
        Update: {
          access_token_secret_ref?: string;
          calendly_user_uri?: string;
          connected_at?: string | null;
          event_type_duration_minutes?: number | null;
          event_type_name?: string | null;
          event_type_uri?: string | null;
          org_id?: string;
          organization_uri?: string | null;
          owner_email?: string | null;
          owner_name?: string | null;
          refresh_token_secret_ref?: string;
          scheduling_url?: string | null;
          status?: string;
          timezone?: string | null;
          token_expires_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendly_connections_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      call_logs: {
        Row: {
          conversation_id: string | null;
          cost_usd: number | null;
          created_at: string | null;
          duration_seconds: number | null;
          id: string;
          outcome: string | null;
          recording_url: string | null;
          summary: string | null;
          transcript: string | null;
          vapi_call_id: string | null;
        };
        Insert: {
          conversation_id?: string | null;
          cost_usd?: number | null;
          created_at?: string | null;
          duration_seconds?: number | null;
          id?: string;
          outcome?: string | null;
          recording_url?: string | null;
          summary?: string | null;
          transcript?: string | null;
          vapi_call_id?: string | null;
        };
        Update: {
          conversation_id?: string | null;
          cost_usd?: number | null;
          created_at?: string | null;
          duration_seconds?: number | null;
          id?: string;
          outcome?: string | null;
          recording_url?: string | null;
          summary?: string | null;
          transcript?: string | null;
          vapi_call_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_logs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          channel: string | null;
          customer_identifier: string | null;
          ended_at: string | null;
          id: string;
          is_sandbox: boolean;
          last_message_at: string | null;
          org_id: string | null;
          resolution_type: string | null;
          service_id: string | null;
          started_at: string | null;
          status: string | null;
          vapi_call_id: string | null;
        };
        Insert: {
          channel?: string | null;
          customer_identifier?: string | null;
          ended_at?: string | null;
          id?: string;
          is_sandbox?: boolean;
          last_message_at?: string | null;
          org_id?: string | null;
          resolution_type?: string | null;
          service_id?: string | null;
          started_at?: string | null;
          status?: string | null;
          vapi_call_id?: string | null;
        };
        Update: {
          channel?: string | null;
          customer_identifier?: string | null;
          ended_at?: string | null;
          id?: string;
          is_sandbox?: boolean;
          last_message_at?: string | null;
          org_id?: string | null;
          resolution_type?: string | null;
          service_id?: string | null;
          started_at?: string | null;
          status?: string | null;
          vapi_call_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_base_entries: {
        Row: {
          content: string;
          created_at: string | null;
          embedded_at: string | null;
          embedding: string | null;
          file_path: string | null;
          id: string;
          needs_review: boolean | null;
          org_id: string | null;
          source: string | null;
          status: string | null;
          title: string | null;
          type: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          embedded_at?: string | null;
          embedding?: string | null;
          file_path?: string | null;
          id?: string;
          needs_review?: boolean | null;
          org_id?: string | null;
          source?: string | null;
          status?: string | null;
          title?: string | null;
          type: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          embedded_at?: string | null;
          embedding?: string | null;
          file_path?: string | null;
          id?: string;
          needs_review?: boolean | null;
          org_id?: string | null;
          source?: string | null;
          status?: string | null;
          title?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_base_entries_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          content: string | null;
          content_type: string | null;
          conversation_id: string | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          sender: string;
          wa_message_id: string | null;
        };
        Insert: {
          content?: string | null;
          content_type?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          sender: string;
          wa_message_id?: string | null;
        };
        Update: {
          content?: string | null;
          content_type?: string | null;
          conversation_id?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          sender?: string;
          wa_message_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string | null;
          org_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          org_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          org_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          country: string | null;
          created_at: string | null;
          id: string;
          industry_vertical: string | null;
          name: string;
          slug: string;
          timezone: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          industry_vertical?: string | null;
          name: string;
          slug: string;
          timezone?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          industry_vertical?: string | null;
          name?: string;
          slug?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      phone_numbers: {
        Row: {
          assigned_service_id: string | null;
          country: string | null;
          id: string;
          monthly_cost_cents: number | null;
          number: string;
          org_id: string | null;
          per_minute_cost_cents: number | null;
          provider: string;
          purchased_at: string | null;
          status: string | null;
          twilio_sid: string | null;
          vapi_number_id: string | null;
        };
        Insert: {
          assigned_service_id?: string | null;
          country?: string | null;
          id?: string;
          monthly_cost_cents?: number | null;
          number: string;
          org_id?: string | null;
          per_minute_cost_cents?: number | null;
          provider: string;
          purchased_at?: string | null;
          status?: string | null;
          twilio_sid?: string | null;
          vapi_number_id?: string | null;
        };
        Update: {
          assigned_service_id?: string | null;
          country?: string | null;
          id?: string;
          monthly_cost_cents?: number | null;
          number?: string;
          org_id?: string | null;
          per_minute_cost_cents?: number | null;
          provider?: string;
          purchased_at?: string | null;
          status?: string | null;
          twilio_sid?: string | null;
          vapi_number_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "phone_numbers_assigned_service_id_fkey";
            columns: ["assigned_service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phone_numbers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          created_at: string | null;
          deployed_at: string | null;
          id: string;
          name: string | null;
          org_id: string | null;
          preview_opened_at: string | null;
          status: string;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          deployed_at?: string | null;
          id?: string;
          name?: string | null;
          org_id?: string | null;
          preview_opened_at?: string | null;
          status?: string;
          type?: string;
        };
        Update: {
          created_at?: string | null;
          deployed_at?: string | null;
          id?: string;
          name?: string | null;
          org_id?: string | null;
          preview_opened_at?: string | null;
          status?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      twilio_subaccounts: {
        Row: {
          auth_token_secret_ref: string;
          created_at: string | null;
          org_id: string;
          status: string | null;
          subaccount_sid: string;
        };
        Insert: {
          auth_token_secret_ref: string;
          created_at?: string | null;
          org_id: string;
          status?: string | null;
          subaccount_sid: string;
        };
        Update: {
          auth_token_secret_ref?: string;
          created_at?: string | null;
          org_id?: string;
          status?: string | null;
          subaccount_sid?: string;
        };
        Relationships: [
          {
            foreignKeyName: "twilio_subaccounts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_agent_configs: {
        Row: {
          after_hours_behavior: string | null;
          background_sound: string | null;
          barge_in_enabled: boolean | null;
          business_hours_override: Json | null;
          call_summary_enabled: boolean | null;
          consent_enabled: boolean | null;
          consent_message: string | null;
          custom_llm_headers: Json | null;
          custom_llm_url: string | null;
          end_call_message: string | null;
          end_call_phrases_enabled: boolean | null;
          escalation_number: string | null;
          first_message_mode: string | null;
          flow_ui_state: Json | null;
          functions_enabled: Json | null;
          greeting_script: string | null;
          kb_enabled: boolean | null;
          language: string | null;
          llm_model: string | null;
          llm_model_escalated: string | null;
          llm_provider: string | null;
          max_call_duration_seconds: number | null;
          multilingual_enabled: boolean | null;
          persona_name: string | null;
          recording_enabled: boolean | null;
          service_id: string;
          temperature: number | null;
          transcriber_language: string | null;
          transcriber_model: string | null;
          transcriber_provider: string | null;
          transfer_destinations: Json | null;
          updated_at: string | null;
          vapi_assistant_id: string | null;
          vapi_phone_number_id: string | null;
          voice_id: string | null;
          voice_model: string | null;
          voice_provider: string | null;
          voicemail_detection_enabled: boolean | null;
          voicemail_message: string | null;
          warm_transfer_enabled: boolean | null;
        };
        Insert: {
          after_hours_behavior?: string | null;
          background_sound?: string | null;
          barge_in_enabled?: boolean | null;
          business_hours_override?: Json | null;
          call_summary_enabled?: boolean | null;
          consent_enabled?: boolean | null;
          consent_message?: string | null;
          custom_llm_headers?: Json | null;
          custom_llm_url?: string | null;
          end_call_message?: string | null;
          end_call_phrases_enabled?: boolean | null;
          escalation_number?: string | null;
          first_message_mode?: string | null;
          flow_ui_state?: Json | null;
          functions_enabled?: Json | null;
          greeting_script?: string | null;
          kb_enabled?: boolean | null;
          language?: string | null;
          llm_model?: string | null;
          llm_model_escalated?: string | null;
          llm_provider?: string | null;
          max_call_duration_seconds?: number | null;
          multilingual_enabled?: boolean | null;
          persona_name?: string | null;
          recording_enabled?: boolean | null;
          service_id: string;
          temperature?: number | null;
          transcriber_language?: string | null;
          transcriber_model?: string | null;
          transcriber_provider?: string | null;
          transfer_destinations?: Json | null;
          updated_at?: string | null;
          vapi_assistant_id?: string | null;
          vapi_phone_number_id?: string | null;
          voice_id?: string | null;
          voice_model?: string | null;
          voice_provider?: string | null;
          voicemail_detection_enabled?: boolean | null;
          voicemail_message?: string | null;
          warm_transfer_enabled?: boolean | null;
        };
        Update: {
          after_hours_behavior?: string | null;
          background_sound?: string | null;
          barge_in_enabled?: boolean | null;
          business_hours_override?: Json | null;
          call_summary_enabled?: boolean | null;
          consent_enabled?: boolean | null;
          consent_message?: string | null;
          custom_llm_headers?: Json | null;
          custom_llm_url?: string | null;
          end_call_message?: string | null;
          end_call_phrases_enabled?: boolean | null;
          escalation_number?: string | null;
          first_message_mode?: string | null;
          flow_ui_state?: Json | null;
          functions_enabled?: Json | null;
          greeting_script?: string | null;
          kb_enabled?: boolean | null;
          language?: string | null;
          llm_model?: string | null;
          llm_model_escalated?: string | null;
          llm_provider?: string | null;
          max_call_duration_seconds?: number | null;
          multilingual_enabled?: boolean | null;
          persona_name?: string | null;
          recording_enabled?: boolean | null;
          service_id?: string;
          temperature?: number | null;
          transcriber_language?: string | null;
          transcriber_model?: string | null;
          transcriber_provider?: string | null;
          transfer_destinations?: Json | null;
          updated_at?: string | null;
          vapi_assistant_id?: string | null;
          vapi_phone_number_id?: string | null;
          voice_id?: string | null;
          voice_model?: string | null;
          voice_provider?: string | null;
          voicemail_detection_enabled?: boolean | null;
          voicemail_message?: string | null;
          warm_transfer_enabled?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "voice_agent_configs_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: true;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      website_configs: {
        Row: {
          connection_status: string;
          deployment_url: string | null;
          footer_content: Json | null;
          footer_variant: string | null;
          last_error: string | null;
          last_published_at: string | null;
          nav_content: Json | null;
          nav_variant: string | null;
          published_theme: Json | null;
          service_id: string;
          template_id: string;
          theme: Json;
          updated_at: string | null;
          vercel_project_id: string | null;
          vercel_project_name: string | null;
          vercel_token_secret_ref: string | null;
        };
        Insert: {
          connection_status?: string;
          deployment_url?: string | null;
          footer_content?: Json | null;
          footer_variant?: string | null;
          last_error?: string | null;
          last_published_at?: string | null;
          nav_content?: Json | null;
          nav_variant?: string | null;
          published_theme?: Json | null;
          service_id: string;
          template_id: string;
          theme?: Json;
          updated_at?: string | null;
          vercel_project_id?: string | null;
          vercel_project_name?: string | null;
          vercel_token_secret_ref?: string | null;
        };
        Update: {
          connection_status?: string;
          deployment_url?: string | null;
          footer_content?: Json | null;
          footer_variant?: string | null;
          last_error?: string | null;
          last_published_at?: string | null;
          nav_content?: Json | null;
          nav_variant?: string | null;
          published_theme?: Json | null;
          service_id?: string;
          template_id?: string;
          theme?: Json;
          updated_at?: string | null;
          vercel_project_id?: string | null;
          vercel_project_name?: string | null;
          vercel_token_secret_ref?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "website_configs_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: true;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      website_pages: {
        Row: {
          created_at: string | null;
          id: string;
          is_home: boolean;
          name: string;
          published_sections: Json | null;
          sections: Json;
          service_id: string;
          show_in_nav: boolean;
          slug: string;
          sort_order: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_home?: boolean;
          name: string;
          published_sections?: Json | null;
          sections?: Json;
          service_id: string;
          show_in_nav?: boolean;
          slug: string;
          sort_order?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_home?: boolean;
          name?: string;
          published_sections?: Json | null;
          sections?: Json;
          service_id?: string;
          show_in_nav?: boolean;
          slug?: string;
          sort_order?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "website_pages_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_bot_configs: {
        Row: {
          access_token_secret_ref: string | null;
          after_hours_behavior: string | null;
          bot_personality_prompt: string | null;
          business_hours_override: Json | null;
          connected_at: string | null;
          connection_status: string;
          escalation_number: string | null;
          functions_enabled: Json | null;
          human_handoff_keywords: string[] | null;
          kb_enabled: boolean | null;
          last_error: string | null;
          llm_model: string | null;
          llm_model_escalated: string | null;
          llm_provider: string | null;
          persona_name: string | null;
          phone_number_display: string | null;
          phone_number_id: string | null;
          service_id: string;
          session_timeout_minutes: number | null;
          temperature: number | null;
          token_expires_at: string | null;
          token_type: string | null;
          updated_at: string | null;
          waba_id: string | null;
          welcome_message: string | null;
          whatsapp_business_name: string | null;
        };
        Insert: {
          access_token_secret_ref?: string | null;
          after_hours_behavior?: string | null;
          bot_personality_prompt?: string | null;
          business_hours_override?: Json | null;
          connected_at?: string | null;
          connection_status?: string;
          escalation_number?: string | null;
          functions_enabled?: Json | null;
          human_handoff_keywords?: string[] | null;
          kb_enabled?: boolean | null;
          last_error?: string | null;
          llm_model?: string | null;
          llm_model_escalated?: string | null;
          llm_provider?: string | null;
          persona_name?: string | null;
          phone_number_display?: string | null;
          phone_number_id?: string | null;
          service_id: string;
          session_timeout_minutes?: number | null;
          temperature?: number | null;
          token_expires_at?: string | null;
          token_type?: string | null;
          updated_at?: string | null;
          waba_id?: string | null;
          welcome_message?: string | null;
          whatsapp_business_name?: string | null;
        };
        Update: {
          access_token_secret_ref?: string | null;
          after_hours_behavior?: string | null;
          bot_personality_prompt?: string | null;
          business_hours_override?: Json | null;
          connected_at?: string | null;
          connection_status?: string;
          escalation_number?: string | null;
          functions_enabled?: Json | null;
          human_handoff_keywords?: string[] | null;
          kb_enabled?: boolean | null;
          last_error?: string | null;
          llm_model?: string | null;
          llm_model_escalated?: string | null;
          llm_provider?: string | null;
          persona_name?: string | null;
          phone_number_display?: string | null;
          phone_number_id?: string | null;
          service_id?: string;
          session_timeout_minutes?: number | null;
          temperature?: number | null;
          token_expires_at?: string | null;
          token_type?: string | null;
          updated_at?: string | null;
          waba_id?: string | null;
          welcome_message?: string | null;
          whatsapp_business_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_configs_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: true;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_calendly_secret: { Args: { p_name: string }; Returns: undefined };
      delete_vercel_secret: { Args: { p_name: string }; Returns: undefined };
      delete_whatsapp_secret: { Args: { p_name: string }; Returns: undefined };
      is_org_member: { Args: { target_org: string }; Returns: boolean };
      match_kb_entries: {
        Args: {
          match_count: number;
          match_org_id: string;
          match_threshold: number;
          query_embedding: string;
        };
        Returns: {
          content: string;
          id: string;
          similarity: number;
          title: string;
        }[];
      };
      read_calendly_secret: { Args: { p_name: string }; Returns: string };
      read_vercel_secret: { Args: { p_name: string }; Returns: string };
      read_whatsapp_secret: { Args: { p_name: string }; Returns: string };
      store_calendly_secret: {
        Args: { p_name: string; p_secret: string };
        Returns: string;
      };
      store_twilio_subaccount_secret: {
        Args: { p_name: string; p_secret: string };
        Returns: string;
      };
      store_vercel_secret: {
        Args: { p_name: string; p_secret: string };
        Returns: string;
      };
      store_whatsapp_secret: {
        Args: { p_name: string; p_secret: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
