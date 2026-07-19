export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          live_session_id: string;
          scenario_id: string;
          title_ko: string | null;
          title_en: string | null;
          status: "active" | "ended";
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          live_session_id: string;
          scenario_id: string;
          title_ko?: string | null;
          title_en?: string | null;
          status?: "active" | "ended";
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          live_session_id?: string;
          scenario_id?: string;
          title_ko?: string | null;
          title_en?: string | null;
          status?: "active" | "ended";
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      turns: {
        Row: {
          id: string;
          practice_session_id: string;
          client_turn_id: string | null;
          role: "user" | "partner";
          transcript: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          practice_session_id: string;
          client_turn_id?: string | null;
          role: "user" | "partner";
          transcript: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          practice_session_id?: string;
          client_turn_id?: string | null;
          role?: "user" | "partner";
          transcript?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      coach_results: {
        Row: {
          id: string;
          turn_id: string;
          practice_session_id: string;
          mode: "partner_assist" | "learner_improve";
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          turn_id: string;
          practice_session_id: string;
          mode: "partner_assist" | "learner_improve";
          payload: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          turn_id?: string;
          practice_session_id?: string;
          mode?: "partner_assist" | "learner_improve";
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      practice_session_summaries: {
        Row: {
          practice_session_id: string;
          recap: Json;
          next_scenario_id: string;
          created_at: string;
        };
        Insert: {
          practice_session_id: string;
          recap: Json;
          next_scenario_id: string;
          created_at?: string;
        };
        Update: {
          practice_session_id?: string;
          recap?: Json;
          next_scenario_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_session_summaries_practice_session_id_fkey";
            columns: ["practice_session_id"];
            isOneToOne: true;
            referencedRelation: "practice_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
