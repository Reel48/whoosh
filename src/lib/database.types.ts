export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bet_event: {
        Row: {
          away_team: string | null
          closes_at: string | null
          commence_time: string | null
          created_at: string
          created_by: string | null
          description: string | null
          external_event_id: string | null
          home_team: string | null
          id: number
          last_synced_at: string | null
          market: string | null
          settled_outcome_id: number | null
          source: string
          sport_key: string | null
          status: string
          title: string
        }
        Insert: {
          away_team?: string | null
          closes_at?: string | null
          commence_time?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_event_id?: string | null
          home_team?: string | null
          id?: number
          last_synced_at?: string | null
          market?: string | null
          settled_outcome_id?: number | null
          source?: string
          sport_key?: string | null
          status: string
          title: string
        }
        Update: {
          away_team?: string | null
          closes_at?: string | null
          commence_time?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_event_id?: string | null
          home_team?: string | null
          id?: number
          last_synced_at?: string | null
          market?: string | null
          settled_outcome_id?: number | null
          source?: string
          sport_key?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_event_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
          {
            foreignKeyName: "bet_event_settled_outcome_fk"
            columns: ["settled_outcome_id"]
            isOneToOne: false
            referencedRelation: "bet_outcome"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_outcome: {
        Row: {
          event_id: number
          id: number
          label: string
          odds_decimal: number
          outcome_key: string | null
          point: number | null
        }
        Insert: {
          event_id: number
          id?: number
          label: string
          odds_decimal: number
          outcome_key?: string | null
          point?: number | null
        }
        Update: {
          event_id?: number
          id?: number
          label?: string
          odds_decimal?: number
          outcome_key?: string | null
          point?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_outcome_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bet_event"
            referencedColumns: ["id"]
          },
        ]
      }
      bet_wager: {
        Row: {
          created_at: string
          discord_user_id: string
          event_id: number
          id: number
          odds_decimal_frozen: number
          outcome_id: number
          point_frozen: number | null
          stake_cents: number
          status: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          event_id: number
          id?: number
          odds_decimal_frozen: number
          outcome_id: number
          point_frozen?: number | null
          stake_cents: number
          status: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          event_id?: number
          id?: number
          odds_decimal_frozen?: number
          outcome_id?: number
          point_frozen?: number | null
          stake_cents?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_wager_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
          {
            foreignKeyName: "bet_wager_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bet_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_wager_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "bet_outcome"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_entitlement: {
        Row: {
          amount_cents: number
          assigned_league_id: string | null
          created_at: string
          discord_user_id: string
          discord_username: string | null
          group_key: string
          id: string
          season: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount_cents?: number
          assigned_league_id?: string | null
          created_at?: string
          discord_user_id: string
          discord_username?: string | null
          group_key: string
          id?: string
          season: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount_cents?: number
          assigned_league_id?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string | null
          group_key?: string
          id?: string
          season?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_entitlement_assigned_league_id_fkey"
            columns: ["assigned_league_id"]
            isOneToOne: false
            referencedRelation: "fantasy_league"
            referencedColumns: ["sleeper_league_id"]
          },
        ]
      }
      fantasy_league: {
        Row: {
          active: boolean
          capacity: number
          created_at: string
          entry_fee_cents: number | null
          group_key: string | null
          join_url: string | null
          kind: string
          logo_url: string | null
          name: string | null
          product_name: string | null
          season: string
          sleeper_league_id: string
          sort: number
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          entry_fee_cents?: number | null
          group_key?: string | null
          join_url?: string | null
          kind?: string
          logo_url?: string | null
          name?: string | null
          product_name?: string | null
          season: string
          sleeper_league_id: string
          sort?: number
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          entry_fee_cents?: number | null
          group_key?: string | null
          join_url?: string | null
          kind?: string
          logo_url?: string | null
          name?: string | null
          product_name?: string | null
          season?: string
          sleeper_league_id?: string
          sort?: number
        }
        Relationships: []
      }
      fantasy_link: {
        Row: {
          discord_user_id: string
          linked_at: string
          sleeper_user_id: string
          sleeper_username: string
        }
        Insert: {
          discord_user_id: string
          linked_at?: string
          sleeper_user_id: string
          sleeper_username: string
        }
        Update: {
          discord_user_id?: string
          linked_at?: string
          sleeper_user_id?: string
          sleeper_username?: string
        }
        Relationships: []
      }
      fantasy_matchup_event: {
        Row: {
          away_outcome_id: number
          away_roster_id: number
          created_at: string
          event_id: number
          home_outcome_id: number
          home_roster_id: number
          id: number
          matchup_id: number
          season: string
          settled: boolean
          sleeper_league_id: string
          week: number
        }
        Insert: {
          away_outcome_id: number
          away_roster_id: number
          created_at?: string
          event_id: number
          home_outcome_id: number
          home_roster_id: number
          id?: never
          matchup_id: number
          season: string
          settled?: boolean
          sleeper_league_id: string
          week: number
        }
        Update: {
          away_outcome_id?: number
          away_roster_id?: number
          created_at?: string
          event_id?: number
          home_outcome_id?: number
          home_roster_id?: number
          id?: never
          matchup_id?: number
          season?: string
          settled?: boolean
          sleeper_league_id?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_matchup_event_away_outcome_id_fkey"
            columns: ["away_outcome_id"]
            isOneToOne: false
            referencedRelation: "bet_outcome"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_matchup_event_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "bet_event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_matchup_event_home_outcome_id_fkey"
            columns: ["home_outcome_id"]
            isOneToOne: false
            referencedRelation: "bet_outcome"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_accrual: {
        Row: {
          accrual_date: string
          amount_cents: number
          discord_user_id: string
          posted: boolean
        }
        Insert: {
          accrual_date: string
          amount_cents: number
          discord_user_id: string
          posted?: boolean
        }
        Update: {
          accrual_date?: string
          amount_cents?: number
          discord_user_id?: string
          posted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "interest_accrual_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      interest_rate: {
        Row: {
          apy_bps: number
          created_at: string
          effective_date: string
          source: string
        }
        Insert: {
          apy_bps: number
          created_at?: string
          effective_date: string
          source: string
        }
        Update: {
          apy_bps?: number
          created_at?: string
          effective_date?: string
          source?: string
        }
        Relationships: []
      }
      invest_order: {
        Row: {
          created_at: string
          discord_user_id: string
          id: number
          price_cents: number
          shares: number
          side: string
          symbol: string
          total_cents: number
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          id?: number
          price_cents: number
          shares: number
          side: string
          symbol: string
          total_cents: number
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          id?: number
          price_cents?: number
          shares?: number
          side?: string
          symbol?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invest_order_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      invest_position: {
        Row: {
          cost_basis_cents: number
          discord_user_id: string
          shares: number
          symbol: string
          updated_at: string
        }
        Insert: {
          cost_basis_cents: number
          discord_user_id: string
          shares: number
          symbol: string
          updated_at?: string
        }
        Update: {
          cost_basis_cents?: number
          discord_user_id?: string
          shares?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invest_position_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      news_article: {
        Row: {
          author: string | null
          created_at: string
          description: string | null
          espn_id: string
          image_url: string | null
          link: string
          points: number
          pub_date: string | null
          sport: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          description?: string | null
          espn_id: string
          image_url?: string | null
          link: string
          points?: number
          pub_date?: string | null
          sport: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          description?: string | null
          espn_id?: string
          image_url?: string | null
          link?: string
          points?: number
          pub_date?: string | null
          sport?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_swipe: {
        Row: {
          created_at: string
          direction: string
          espn_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: string
          espn_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          espn_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_swipe_espn_id_fkey"
            columns: ["espn_id"]
            isOneToOne: false
            referencedRelation: "news_article"
            referencedColumns: ["espn_id"]
          },
        ]
      }
      notification: {
        Row: {
          body: string | null
          created_at: string
          discord_user_id: string
          href: string | null
          id: number
          kind: string
          metadata: Json
          read_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          discord_user_id: string
          href?: string | null
          id?: number
          kind: string
          metadata?: Json
          read_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          discord_user_id?: string
          href?: string | null
          id?: number
          kind?: string
          metadata?: Json
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_user_id: string | null
          has_password: boolean
          is_admin: boolean
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_user_id?: string | null
          has_password?: boolean
          is_admin?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_user_id?: string | null
          has_password?: boolean
          is_admin?: boolean
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      referral_code: {
        Row: {
          code: string
          created_at: string
          discord_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discord_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discord_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_code_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: true
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      referral_use: {
        Row: {
          code: string
          created_at: string
          id: number
          referred_user_id: string
          referrer_user_id: string
          reward_amount_cents: number | null
          rewarded: boolean
          rewarded_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          referred_user_id: string
          referrer_user_id: string
          reward_amount_cents?: number | null
          rewarded?: boolean
          rewarded_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          referred_user_id?: string
          referrer_user_id?: string
          reward_amount_cents?: number | null
          rewarded?: boolean
          rewarded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_use_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
          {
            foreignKeyName: "referral_use_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      symbol_quote: {
        Row: {
          fetched_at: string
          last_price_cents: number
          prev_close_cents: number | null
          symbol: string
        }
        Insert: {
          fetched_at: string
          last_price_cents: number
          prev_close_cents?: number | null
          symbol: string
        }
        Update: {
          fetched_at?: string
          last_price_cents?: number
          prev_close_cents?: number | null
          symbol?: string
        }
        Relationships: []
      }
      user_achievement: {
        Row: {
          code: string
          discord_user_id: string
          earned_at: string
          metadata: Json
        }
        Insert: {
          code: string
          discord_user_id: string
          earned_at?: string
          metadata?: Json
        }
        Update: {
          code?: string
          discord_user_id?: string
          earned_at?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_achievement_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      user_daily_bonus: {
        Row: {
          amount_cents: number
          claim_date: string
          created_at: string
          discord_user_id: string
          streak_day: number
        }
        Insert: {
          amount_cents: number
          claim_date: string
          created_at?: string
          discord_user_id: string
          streak_day: number
        }
        Update: {
          amount_cents?: number
          claim_date?: string
          created_at?: string
          discord_user_id?: string
          streak_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_daily_bonus_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      user_watchlist: {
        Row: {
          added_at: string
          discord_user_id: string
          symbol: string
        }
        Insert: {
          added_at?: string
          discord_user_id: string
          symbol: string
        }
        Update: {
          added_at?: string
          discord_user_id?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_watchlist_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      wallet: {
        Row: {
          created_at: string
          discord_user_id: string
          discord_username: string
        }
        Insert: {
          created_at?: string
          discord_user_id: string
          discord_username: string
        }
        Update: {
          created_at?: string
          discord_user_id?: string
          discord_username?: string
        }
        Relationships: []
      }
      wb_dividend: {
        Row: {
          created_at: string
          ex_date: string
          id: number
          posted_by: string | null
          source: string
          symbol: string
          users_credited: number
          wb_cents_per_share: number
        }
        Insert: {
          created_at?: string
          ex_date: string
          id?: number
          posted_by?: string | null
          source: string
          symbol: string
          users_credited?: number
          wb_cents_per_share: number
        }
        Update: {
          created_at?: string
          ex_date?: string
          id?: number
          posted_by?: string | null
          source?: string
          symbol?: string
          users_credited?: number
          wb_cents_per_share?: number
        }
        Relationships: []
      }
      wb_ledger: {
        Row: {
          amount_cents: number
          created_at: string
          discord_user_id: string
          id: number
          kind: string
          memo: string | null
          metadata: Json
          ref_id: string | null
          ref_kind: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          discord_user_id: string
          id?: number
          kind: string
          memo?: string | null
          metadata?: Json
          ref_id?: string | null
          ref_kind?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          discord_user_id?: string
          id?: number
          kind?: string
          memo?: string | null
          metadata?: Json
          ref_id?: string | null
          ref_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wb_ledger_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
      wb_transfer: {
        Row: {
          amount_cents: number
          created_at: string
          from_user: string
          id: number
          memo: string | null
          to_user: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          from_user: string
          id?: number
          memo?: string | null
          to_user: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          from_user?: string
          id?: number
          memo?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "wb_transfer_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
          {
            foreignKeyName: "wb_transfer_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
    }
    Views: {
      wallet_balance: {
        Row: {
          balance_cents: number | null
          discord_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wb_ledger_discord_user_id_fkey"
            columns: ["discord_user_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["discord_user_id"]
          },
        ]
      }
    }
    Functions: {
      admin_subscriber_identities: {
        Args: { p_discord_ids: string[]; p_user_ids: string[] }
        Returns: {
          discord_user_id: string
          email: string
          user_id: string
          username: string
        }[]
      }
      assign_league_entitlement: {
        Args: {
          p_amount_cents: number
          p_discord_user_id: string
          p_discord_username: string
          p_group_key: string
          p_payment_intent_id: string
          p_season: string
          p_session_id: string
        }
        Returns: {
          amount_cents: number
          assigned_league_id: string | null
          created_at: string
          discord_user_id: string
          discord_username: string | null
          group_key: string
          id: string
          season: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "fantasy_entitlement"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_legacy_wallet: {
        Args: { p_discord_user_id: string; p_new_user_id: string }
        Returns: boolean
      }
      delete_news_swipe: {
        Args: { p_espn_id: string; p_user: string }
        Returns: number
      }
      ensure_wallet: {
        Args: { p_user_id: string; p_username: string }
        Returns: undefined
      }
      fn_accrue_interest: { Args: { p_date: string }; Returns: number }
      fn_cancel_event: { Args: { p_event_id: number }; Returns: number }
      fn_claim_daily_bonus: {
        Args: { p_user_id: string }
        Returns: {
          amount_cents: number
          claimed: boolean
          streak: number
        }[]
      }
      fn_credit_ledger: {
        Args: {
          p_amount_cents: number
          p_kind: string
          p_memo: string
          p_metadata?: Json
          p_ref_id: string
          p_ref_kind: string
          p_user_id: string
        }
        Returns: number
      }
      fn_invest_buy: {
        Args: {
          p_price_cents: number
          p_shares: number
          p_symbol: string
          p_user_id: string
        }
        Returns: number
      }
      fn_invest_sell: {
        Args: {
          p_price_cents: number
          p_shares: number
          p_symbol: string
          p_user_id: string
        }
        Returns: number
      }
      fn_place_wager: {
        Args: {
          p_event_id: number
          p_outcome_id: number
          p_stake_cents: number
          p_user_id: string
        }
        Returns: number
      }
      fn_post_dividend: {
        Args: {
          p_ex_date: string
          p_symbol: string
          p_wb_cents_per_share: number
        }
        Returns: number
      }
      fn_post_interest: { Args: { p_through_date: string }; Returns: number }
      fn_rate_for_date: { Args: { p_date: string }; Returns: number }
      fn_set_interest_rate: {
        Args: { p_apy_bps: number; p_effective_date: string; p_source: string }
        Returns: undefined
      }
      fn_settle_event: {
        Args: { p_event_id: number; p_winning_outcome_id: number }
        Returns: number
      }
      fn_settle_event_by_score: {
        Args: { p_away_score: number; p_event_id: number; p_home_score: number }
        Returns: number
      }
      fn_total_wb_outstanding: { Args: never; Returns: number }
      fn_transfer: {
        Args: {
          p_amount_cents: number
          p_from: string
          p_memo: string
          p_to: string
        }
        Returns: number
      }
      fn_user_balance_series: {
        Args: { p_days: number; p_user_id: string }
        Returns: {
          balance_cents: number
          day: string
        }[]
      }
      fn_user_lifetime_stats: {
        Args: { p_user_id: string }
        Returns: {
          ledger_row_count: number
          total_adjustment: number
          total_bet_payout: number
          total_bet_stake: number
          total_interest: number
          total_invest_buy: number
          total_invest_dividend: number
          total_invest_sell: number
          total_premium_match: number
          total_purchased: number
          total_transfer_in: number
          total_transfer_out: number
        }[]
      }
      fn_user_open_wager_stake: { Args: { p_user_id: string }; Returns: number }
      fn_user_streak: { Args: { p_user_id: string }; Returns: number }
      fn_wb_dau: { Args: { p_days?: number }; Returns: number }
      fn_wb_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          cash_cents: number
          discord_user_id: string
          discord_username: string
          invested_cost_basis_cents: number
          open_wager_stakes_cents: number
          rank: number
          total_wb_cents: number
        }[]
      }
      fn_wb_leaderboard_biggest_wins: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          created_at: string
          discord_user_id: string
          discord_username: string
          memo: string
          payout_cents: number
          rank: number
        }[]
      }
      fn_wb_leaderboard_streaks: {
        Args: { p_limit?: number }
        Returns: {
          discord_user_id: string
          discord_username: string
          rank: number
          streak_day: number
        }[]
      }
      fn_wb_leaderboard_traders: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          discord_user_id: string
          discord_username: string
          rank: number
          realized_pl_cents: number
          trades: number
        }[]
      }
      fn_wb_supply_series: {
        Args: { p_days?: number }
        Returns: {
          day: string
          supply_cents: number
        }[]
      }
      fn_wb_total_supply: { Args: never; Returns: number }
      normalize_handle: { Args: { input: string }; Returns: string }
      record_news_swipe: {
        Args: { p_article: Json; p_direction: string; p_user: string }
        Returns: number
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

