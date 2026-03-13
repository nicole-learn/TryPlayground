export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      credit_ledger: {
        Row: {
          created_at: string;
          delta_credits: number;
          id: string;
          metadata: Json;
          reason: string;
          related_run_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          delta_credits: number;
          id?: string;
          metadata?: Json;
          reason: string;
          related_run_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          delta_credits?: number;
          id?: string;
          metadata?: Json;
          reason?: string;
          related_run_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_related_run_id_fkey";
            columns: ["related_run_id"];
            isOneToOne: false;
            referencedRelation: "generation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      generation_run_inputs: {
        Row: {
          created_at: string;
          id: string;
          input_role: string;
          library_item_id: string | null;
          position: number;
          run_file_id: string | null;
          run_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input_role: string;
          library_item_id?: string | null;
          position?: number;
          run_file_id?: string | null;
          run_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_role?: string;
          library_item_id?: string | null;
          position?: number;
          run_file_id?: string | null;
          run_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generation_run_inputs_library_item_id_fkey";
            columns: ["library_item_id"];
            isOneToOne: false;
            referencedRelation: "library_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_run_inputs_run_file_id_fkey";
            columns: ["run_file_id"];
            isOneToOne: false;
            referencedRelation: "run_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_run_inputs_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "generation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_run_inputs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      generation_runs: {
        Row: {
          actual_cost_usd: number | null;
          actual_credits: number | null;
          can_cancel: boolean;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          dispatch_attempt_count: number;
          dispatch_lease_expires_at: string | null;
          draft_snapshot: Json;
          error_message: string | null;
          estimated_cost_usd: number | null;
          estimated_credits: number | null;
          failed_at: string | null;
          folder_id: string | null;
          id: string;
          input_payload: Json;
          input_settings: Json;
          kind: string;
          model_id: string;
          model_name: string;
          output_asset_id: string | null;
          output_text: string | null;
          preview_url: string | null;
          pricing_snapshot: Json;
          prompt: string;
          provider: string;
          provider_request_id: string | null;
          provider_status: string | null;
          queue_entered_at: string;
          request_mode: string;
          started_at: string | null;
          status: string;
          summary: string;
          updated_at: string;
          usage_snapshot: Json;
          user_id: string;
        };
        Insert: {
          actual_cost_usd?: number | null;
          actual_credits?: number | null;
          can_cancel?: boolean;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispatch_attempt_count?: number;
          dispatch_lease_expires_at?: string | null;
          draft_snapshot?: Json;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          estimated_credits?: number | null;
          failed_at?: string | null;
          folder_id?: string | null;
          id?: string;
          input_payload?: Json;
          input_settings?: Json;
          kind: string;
          model_id: string;
          model_name: string;
          output_asset_id?: string | null;
          output_text?: string | null;
          preview_url?: string | null;
          pricing_snapshot?: Json;
          prompt?: string;
          provider?: string;
          provider_request_id?: string | null;
          provider_status?: string | null;
          queue_entered_at?: string;
          request_mode: string;
          started_at?: string | null;
          status: string;
          summary?: string;
          updated_at?: string;
          usage_snapshot?: Json;
          user_id: string;
        };
        Update: {
          actual_cost_usd?: number | null;
          actual_credits?: number | null;
          can_cancel?: boolean;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          dispatch_attempt_count?: number;
          dispatch_lease_expires_at?: string | null;
          draft_snapshot?: Json;
          error_message?: string | null;
          estimated_cost_usd?: number | null;
          estimated_credits?: number | null;
          failed_at?: string | null;
          folder_id?: string | null;
          id?: string;
          input_payload?: Json;
          input_settings?: Json;
          kind?: string;
          model_id?: string;
          model_name?: string;
          output_asset_id?: string | null;
          output_text?: string | null;
          preview_url?: string | null;
          pricing_snapshot?: Json;
          prompt?: string;
          provider?: string;
          provider_request_id?: string | null;
          provider_status?: string | null;
          queue_entered_at?: string;
          request_mode?: string;
          started_at?: string | null;
          status?: string;
          summary?: string;
          updated_at?: string;
          usage_snapshot?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generation_runs_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generation_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      library_items: {
        Row: {
          aspect_ratio_label: string | null;
          byte_size: number | null;
          content_text: string | null;
          created_at: string;
          error_message: string | null;
          file_name: string | null;
          folder_id: string | null;
          has_alpha: boolean;
          id: string;
          kind: string;
          media_duration_seconds: number | null;
          media_height: number | null;
          media_width: number | null;
          meta: string;
          metadata: Json;
          mime_type: string | null;
          model_id: string | null;
          prompt: string;
          provider: string;
          role: string;
          run_file_id: string | null;
          run_id: string | null;
          source: string;
          source_run_id: string | null;
          status: string;
          thumbnail_file_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          aspect_ratio_label?: string | null;
          byte_size?: number | null;
          content_text?: string | null;
          created_at?: string;
          error_message?: string | null;
          file_name?: string | null;
          folder_id?: string | null;
          has_alpha?: boolean;
          id?: string;
          kind: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_width?: number | null;
          meta?: string;
          metadata?: Json;
          mime_type?: string | null;
          model_id?: string | null;
          prompt?: string;
          provider?: string;
          role: string;
          run_file_id?: string | null;
          run_id?: string | null;
          source: string;
          source_run_id?: string | null;
          status?: string;
          thumbnail_file_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          aspect_ratio_label?: string | null;
          byte_size?: number | null;
          content_text?: string | null;
          created_at?: string;
          error_message?: string | null;
          file_name?: string | null;
          folder_id?: string | null;
          has_alpha?: boolean;
          id?: string;
          kind?: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_width?: number | null;
          meta?: string;
          metadata?: Json;
          mime_type?: string | null;
          model_id?: string | null;
          prompt?: string;
          provider?: string;
          role?: string;
          run_file_id?: string | null;
          run_id?: string | null;
          source?: string;
          source_run_id?: string | null;
          status?: string;
          thumbnail_file_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "library_items_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_run_file_id_fkey";
            columns: ["run_file_id"];
            isOneToOne: false;
            referencedRelation: "run_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "generation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_source_run_id_fkey";
            columns: ["source_run_id"];
            isOneToOne: false;
            referencedRelation: "generation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_thumbnail_file_id_fkey";
            columns: ["thumbnail_file_id"];
            isOneToOne: false;
            referencedRelation: "run_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      run_files: {
        Row: {
          aspect_ratio_label: string | null;
          created_at: string;
          file_name: string | null;
          file_role: string;
          file_size_bytes: number | null;
          has_alpha: boolean;
          id: string;
          media_duration_seconds: number | null;
          media_height: number | null;
          media_width: number | null;
          metadata: Json;
          mime_type: string | null;
          run_id: string | null;
          source_type: string;
          storage_bucket: string;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          aspect_ratio_label?: string | null;
          created_at?: string;
          file_name?: string | null;
          file_role: string;
          file_size_bytes?: number | null;
          has_alpha?: boolean;
          id?: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_width?: number | null;
          metadata?: Json;
          mime_type?: string | null;
          run_id?: string | null;
          source_type: string;
          storage_bucket: string;
          storage_path: string;
          user_id: string;
        };
        Update: {
          aspect_ratio_label?: string | null;
          created_at?: string;
          file_name?: string | null;
          file_role?: string;
          file_size_bytes?: number | null;
          has_alpha?: boolean;
          id?: string;
          media_duration_seconds?: number | null;
          media_height?: number | null;
          media_width?: number | null;
          metadata?: Json;
          mime_type?: string | null;
          run_id?: string | null;
          source_type?: string;
          storage_bucket?: string;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "run_files_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "generation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "run_files_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "studio_accounts";
            referencedColumns: ["user_id"];
          },
        ];
      };
      studio_accounts: {
        Row: {
          active_credit_pack: number | null;
          avatar_label: string;
          avatar_url: string | null;
          created_at: string;
          credit_balance: number;
          display_name: string;
          enabled_model_ids: string[];
          gallery_size_level: number;
          revision: number;
          selected_model_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_credit_pack?: number | null;
          avatar_label?: string;
          avatar_url?: string | null;
          created_at?: string;
          credit_balance?: number;
          display_name?: string;
          enabled_model_ids?: string[];
          gallery_size_level?: number;
          revision?: number;
          selected_model_id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_credit_pack?: number | null;
          avatar_label?: string;
          avatar_url?: string | null;
          created_at?: string;
          credit_balance?: number;
          display_name?: string;
          enabled_model_ids?: string[];
          gallery_size_level?: number;
          revision?: number;
          selected_model_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      studio_system_config: {
        Row: {
          created_at: string;
          id: boolean;
          local_concurrency_limit: number;
          max_active_jobs_per_user: number;
          provider_slot_limit: number;
          rotation_slice_ms: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: boolean;
          local_concurrency_limit?: number;
          max_active_jobs_per_user?: number;
          provider_slot_limit?: number;
          rotation_slice_ms?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: boolean;
          local_concurrency_limit?: number;
          max_active_jobs_per_user?: number;
          provider_slot_limit?: number;
          rotation_slice_ms?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bump_studio_account_revision: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      get_tryplayground_active_hosted_user_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
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
