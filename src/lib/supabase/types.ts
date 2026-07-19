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
        Relationships: [];
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
