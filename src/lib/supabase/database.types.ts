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
      addresses: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          complemento: string
          created_at: string
          customer_id: string
          id: string
          rua: string
          updated_at: string
        }
        Insert: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          customer_id: string
          id?: string
          rua?: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string
          created_at?: string
          customer_id?: string
          id?: string
          rua?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          id: string
          image_label: string
          position: number
          product_id: string | null
          subtitle: string
          tag: string
          title: string
        }
        Insert: {
          id?: string
          image_label?: string
          position?: number
          product_id?: string | null
          subtitle?: string
          tag?: string
          title?: string
        }
        Update: {
          id?: string
          image_label?: string
          position?: number
          product_id?: string | null
          subtitle?: string
          tag?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          glyph: string
          id: string
          image_url: string | null
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          glyph?: string
          id?: string
          image_url?: string | null
          name: string
          position?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          glyph?: string
          id?: string
          image_url?: string | null
          name?: string
          position?: number
        }
        Relationships: []
      }
      collections: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          position: number
          show_in_feed: boolean
          show_on_site: boolean
          site_position: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          position?: number
          show_in_feed?: boolean
          show_on_site?: boolean
          site_position?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          position?: number
          show_in_feed?: boolean
          show_on_site?: boolean
          site_position?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          pct: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          pct: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          pct?: number
          uses?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line: string | null
          address_number: string | null
          cep: string | null
          city: string | null
          company: string | null
          complement: string | null
          created_at: string
          district: string | null
          doc: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          profile_id: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          company?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          address_number?: string | null
          cep?: string | null
          city?: string | null
          company?: string | null
          complement?: string | null
          created_at?: string
          district?: string | null
          doc?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          customer_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          created_at: string
          description: string
          entry_date: string
          id: string
          installment_id: string | null
          installment_number: number | null
          kind: string
          paid_by_owner: boolean
          reference_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          installment_id?: string | null
          installment_number?: number | null
          kind: string
          paid_by_owner?: boolean
          reference_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          installment_id?: string | null
          installment_number?: number | null
          kind?: string
          paid_by_owner?: boolean
          reference_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_services: {
        Row: {
          active: boolean
          billing_type: string
          category: string
          created_at: string
          description: string
          id: string
          lead_time_days: number
          name: string
          position: number
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          lead_time_days?: number
          name: string
          position?: number
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          lead_time_days?: number
          name?: string
          position?: number
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_search_requests: {
        Row: {
          city: string
          country: string
          created_at: string
          finished_at: string | null
          id: string
          message: string | null
          new_leads: number | null
          niche: string
          started_at: string | null
          status: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          message?: string | null
          new_leads?: number | null
          niche: string
          started_at?: string | null
          status?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          message?: string | null
          new_leads?: number | null
          niche?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      cobrancas: {
        Row: {
          ambiente: string
          asaas_payment_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          lead_id: string
          link: string | null
          pago_em: string | null
          parcela: string
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          ambiente?: string
          asaas_payment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          lead_id: string
          link?: string | null
          pago_em?: string | null
          parcela: string
          status?: string
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          ambiente?: string
          asaas_payment_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          link?: string | null
          pago_em?: string | null
          parcela?: string
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ia_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_avisos: {
        Row: {
          conversation_id: string | null
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          lead_id: string | null
          status: string | null
          texto: string
          titulo: string
          via: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          texto: string
          titulo: string
          via: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          status?: string | null
          texto?: string
          titulo?: string
          via?: string
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          conversation_id: string | null
          created_at: string
          email_cliente: string | null
          fim: string
          google_event_id: string | null
          id: string
          inicio: string
          lead_id: string | null
          meet_link: string | null
          status: string
          titulo: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          email_cliente?: string | null
          fim: string
          google_event_id?: string | null
          id?: string
          inicio: string
          lead_id?: string | null
          meet_link?: string | null
          status?: string
          titulo: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          email_cliente?: string | null
          fim?: string
          google_event_id?: string | null
          id?: string
          inicio?: string
          lead_id?: string | null
          meet_link?: string | null
          status?: string
          titulo?: string
        }
        Relationships: []
      }
      integracoes: {
        Row: {
          chave: string
          dados: Json
          updated_at: string
        }
        Insert: {
          chave: string
          dados?: Json
          updated_at?: string
        }
        Update: {
          chave?: string
          dados?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ia_aprendizados: {
        Row: {
          conversation_ids: string[]
          created_at: string
          decided_at: string | null
          exemplo: string | null
          id: string
          ramo: string | null
          status: string
          texto: string
          tipo: string
          vezes: number
        }
        Insert: {
          conversation_ids?: string[]
          created_at?: string
          decided_at?: string | null
          exemplo?: string | null
          id?: string
          ramo?: string | null
          status?: string
          texto: string
          tipo: string
          vezes?: number
        }
        Update: {
          conversation_ids?: string[]
          created_at?: string
          decided_at?: string | null
          exemplo?: string | null
          id?: string
          ramo?: string | null
          status?: string
          texto?: string
          tipo?: string
          vezes?: number
        }
        Relationships: []
      }
      ia_config: {
        Row: {
          active: boolean
          auto_model: boolean
          daily_email_cap: number
          discount_wait_minutes: number
          extra_discount_max: number
          id: boolean
          model: string
          aviso_template_status: string | null
          monthly_budget_usd: number
          owner_email: string | null
          owner_last_inbound_at: string | null
          owner_whatsapp: string | null
          persona_name: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          active?: boolean
          auto_model?: boolean
          daily_email_cap?: number
          discount_wait_minutes?: number
          extra_discount_max?: number
          id?: boolean
          model?: string
          monthly_budget_usd?: number
          owner_email?: string | null
          persona_name?: string
          updated_at?: string
          aviso_template_status?: string | null
          owner_last_inbound_at?: string | null
          owner_whatsapp?: string | null
          waba_id?: string | null
        }
        Update: {
          active?: boolean
          auto_model?: boolean
          daily_email_cap?: number
          discount_wait_minutes?: number
          extra_discount_max?: number
          id?: boolean
          model?: string
          monthly_budget_usd?: number
          owner_email?: string | null
          persona_name?: string
          updated_at?: string
          aviso_template_status?: string | null
          owner_last_inbound_at?: string | null
          owner_whatsapp?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      ia_conversations: {
        Row: {
          channel: string
          contact_id: string
          contact_name: string | null
          created_at: string
          id: string
          is_test: boolean
          kit_id: string | null
          last_inbound_at: string | null
          last_message_at: string
          learned_at: string | null
          lead_id: string | null
          mode: string
          needs_human: boolean
          needs_human_reason: string | null
          summary: string | null
          unread: number
        }
        Insert: {
          channel?: string
          contact_id: string
          contact_name?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          kit_id?: string | null
          last_inbound_at?: string | null
          last_message_at?: string
          learned_at?: string | null
          lead_id?: string | null
          mode?: string
          needs_human?: boolean
          needs_human_reason?: string | null
          summary?: string | null
          unread?: number
        }
        Update: {
          channel?: string
          contact_id?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          is_test?: boolean
          kit_id?: string | null
          last_inbound_at?: string | null
          last_message_at?: string
          learned_at?: string | null
          lead_id?: string | null
          mode?: string
          needs_human?: boolean
          needs_human_reason?: string | null
          summary?: string | null
          unread?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_conversations_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "lead_seller_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_messages: {
        Row: {
          author: string
          body: string
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          external_id: string | null
          id: string
          media_id: string | null
          media_mime: string | null
          media_name: string | null
          media_type: string | null
          status: string | null
          storage_path: string | null
          synced_at: string | null
        }
        Insert: {
          author: string
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_id?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_type?: string | null
          status?: string | null
          storage_path?: string | null
          synced_at?: string | null
        }
        Update: {
          author?: string
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          external_id?: string | null
          id?: string
          media_id?: string | null
          media_mime?: string | null
          media_name?: string | null
          media_type?: string | null
          status?: string | null
          storage_path?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ia_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_discount_requests: {
        Row: {
          answered_at: string | null
          conversation_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          lead_id: string | null
          percent: number
          reason: string | null
          release_at: string
          status: string
        }
        Insert: {
          answered_at?: string | null
          conversation_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lead_id?: string | null
          percent: number
          reason?: string | null
          release_at: string
          status?: string
        }
        Update: {
          answered_at?: string | null
          conversation_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          lead_id?: string | null
          percent?: number
          reason?: string | null
          release_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_discount_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ia_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_discount_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_emails: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          kit_id: string | null
          lead_id: string
          sent_at: string | null
          step: number
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          kit_id?: string | null
          lead_id: string
          sent_at?: string | null
          step: number
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          kit_id?: string | null
          lead_id?: string
          sent_at?: string | null
          step?: number
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_emails_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "lead_seller_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_usage: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          conversation_id: string | null
          cost_usd: number
          created_at: string
          id: number
          input_tokens: number
          model: string
          output_tokens: number
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: number
          input_tokens?: number
          model: string
          output_tokens?: number
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversation_id?: string | null
          cost_usd?: number
          created_at?: string
          id?: number
          input_tokens?: number
          model?: string
          output_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_usage_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ia_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_seller_kits: {
        Row: {
          active: boolean
          catalog: Json
          created_at: string
          filters: Json
          id: string
          instructions: string | null
          kind: string
          more_requested_at: string | null
          seller_email: string | null
          seller_name: string
          seller_whatsapp: string | null
          token: string
        }
        Insert: {
          active?: boolean
          catalog?: Json
          created_at?: string
          filters?: Json
          id?: string
          instructions?: string | null
          kind?: string
          more_requested_at?: string | null
          seller_email?: string | null
          seller_name: string
          seller_whatsapp?: string | null
          token?: string
        }
        Update: {
          active?: boolean
          catalog?: Json
          created_at?: string
          filters?: Json
          id?: string
          instructions?: string | null
          kind?: string
          more_requested_at?: string | null
          seller_email?: string | null
          seller_name?: string
          seller_whatsapp?: string | null
          token?: string
        }
        Relationships: []
      }
      lead_kit_items: {
        Row: {
          combo: boolean
          currency: string
          kit_id: string
          lead_id: string
          monthly: number
          one_time: number
          position: number
          services: Json
        }
        Insert: {
          combo?: boolean
          currency?: string
          kit_id: string
          lead_id: string
          monthly?: number
          one_time?: number
          position?: number
          services?: Json
        }
        Update: {
          combo?: boolean
          currency?: string
          kit_id?: string
          lead_id?: string
          monthly?: number
          one_time?: number
          position?: number
          services?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lead_kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "lead_seller_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_kit_transfers: {
        Row: {
          kit_id: string
          lead_id: string
          replacement_lead_id: string | null
          taken_at: string
        }
        Insert: {
          kit_id: string
          lead_id: string
          replacement_lead_id?: string | null
          taken_at?: string
        }
        Update: {
          kit_id?: string
          lead_id?: string
          replacement_lead_id?: string | null
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_kit_transfers_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "lead_seller_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_transfers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_kit_transfers_replacement_lead_id_fkey"
            columns: ["replacement_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_templates: {
        Row: {
          body: string
          channel: string
          id: string
          lang: string
          step: number
          subject: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          body: string
          channel: string
          id?: string
          lang: string
          step?: number
          subject?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          body?: string
          channel?: string
          id?: string
          lang?: string
          step?: number
          subject?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          ab_variant: string | null
          address: string | null
          category: string | null
          city: string | null
          closed_at: string | null
          country: string
          created_at: string
          customer_id: string | null
          dedupe_key: string
          diag_first_view_at: string | null
          diag_last_view_at: string | null
          diag_views: number
          discovery: Json
          discovery_at: string | null
          maps_status: string | null
          last_review_at: string | null
          owner_claimed: boolean | null
          opening_hours: Json | null
          attributes: string[] | null
          online_booking: string | null
          rating_dist: Json | null
          recent_reviews: Json | null
          porte: string | null
          unidades: number
          discovery_by: string | null
          email: string | null
          facebook: string | null
          first_contact_at: string | null
          followup_step: number
          id: string
          instagram: string | null
          last_contact_at: string | null
          latitude: number | null
          linkedin: string | null
          longitude: number | null
          maps_url: string | null
          name: string
          next_contact: string | null
          niche: string | null
          notes: string | null
          phone: string | null
          place_id: string | null
          public_token: string
          quote_id: string | null
          rating: number | null
          reasons: string[]
          replied_at: string | null
          responsible_name: string | null
          asaas_customer_id: string | null
          closed_value: number | null
          closed_monthly: number | null
          closed_currency: string | null
          review_count: number | null
          score: number
          screenshot_url: string | null
          sem_whatsapp: boolean
          site_check: string | null
          source: string | null
          state: string | null
          status: string
          suggested_services: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          ab_variant?: string | null
          address?: string | null
          category?: string | null
          city?: string | null
          closed_at?: string | null
          country?: string
          created_at?: string
          customer_id?: string | null
          dedupe_key: string
          diag_first_view_at?: string | null
          diag_last_view_at?: string | null
          diag_views?: number
          discovery?: Json
          discovery_at?: string | null
          maps_status?: string | null
          last_review_at?: string | null
          owner_claimed?: boolean | null
          opening_hours?: Json | null
          attributes?: string[] | null
          online_booking?: string | null
          rating_dist?: Json | null
          recent_reviews?: Json | null
          porte?: string | null
          unidades?: number
          discovery_by?: string | null
          email?: string | null
          facebook?: string | null
          first_contact_at?: string | null
          followup_step?: number
          id?: string
          instagram?: string | null
          last_contact_at?: string | null
          latitude?: number | null
          linkedin?: string | null
          longitude?: number | null
          maps_url?: string | null
          name: string
          next_contact?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          public_token?: string
          quote_id?: string | null
          rating?: number | null
          reasons?: string[]
          replied_at?: string | null
          responsible_name?: string | null
          asaas_customer_id?: string | null
          closed_value?: number | null
          closed_monthly?: number | null
          closed_currency?: string | null
          review_count?: number | null
          score?: number
          screenshot_url?: string | null
          sem_whatsapp?: boolean
          site_check?: string | null
          source?: string | null
          state?: string | null
          status?: string
          suggested_services?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          ab_variant?: string | null
          address?: string | null
          category?: string | null
          city?: string | null
          closed_at?: string | null
          country?: string
          created_at?: string
          customer_id?: string | null
          dedupe_key?: string
          diag_first_view_at?: string | null
          diag_last_view_at?: string | null
          diag_views?: number
          discovery?: Json
          discovery_at?: string | null
          maps_status?: string | null
          last_review_at?: string | null
          owner_claimed?: boolean | null
          opening_hours?: Json | null
          attributes?: string[] | null
          online_booking?: string | null
          rating_dist?: Json | null
          recent_reviews?: Json | null
          porte?: string | null
          unidades?: number
          discovery_by?: string | null
          email?: string | null
          facebook?: string | null
          first_contact_at?: string | null
          followup_step?: number
          id?: string
          instagram?: string | null
          last_contact_at?: string | null
          latitude?: number | null
          linkedin?: string | null
          longitude?: number | null
          maps_url?: string | null
          name?: string
          next_contact?: string | null
          niche?: string | null
          notes?: string | null
          phone?: string | null
          place_id?: string | null
          public_token?: string
          quote_id?: string | null
          rating?: number | null
          reasons?: string[]
          replied_at?: string | null
          responsible_name?: string | null
          asaas_customer_id?: string | null
          closed_value?: number | null
          closed_monthly?: number | null
          closed_currency?: string | null
          review_count?: number | null
          score?: number
          screenshot_url?: string | null
          sem_whatsapp?: boolean
          site_check?: string | null
          source?: string | null
          state?: string | null
          status?: string
          suggested_services?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          id: string
          note: string
          occurred_at: string
          order_id: string
          stage: number
        }
        Insert: {
          id?: string
          note?: string
          occurred_at?: string
          order_id: string
          stage: number
        }
        Update: {
          id?: string
          note?: string
          occurred_at?: string
          order_id?: string
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          qty: number
          stock_item_id: string | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          stock_item_id?: string | null
          unit_cost?: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          stock_item_id?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          budget_id: string | null
          cost_total: number
          coupon_code: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          discount: number
          down_payment: number
          erp_customer_id: string | null
          first_due_date: string | null
          id: string
          installment_count: number
          installment_notes: string
          interest_pct: number
          is_import: boolean
          name: string
          order_number: number
          origin: string
          payment_method: string
          sale_date: string | null
          shipping: number
          status: string
          subtotal: number
          timeline_stage: number
          total: number
          tracking_code: string | null
          tracking_url: string | null
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          budget_id?: string | null
          cost_total?: number
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          discount?: number
          down_payment?: number
          erp_customer_id?: string | null
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          is_import?: boolean
          name?: string
          order_number: number
          origin?: string
          payment_method?: string
          sale_date?: string | null
          shipping?: number
          status?: string
          subtotal?: number
          timeline_stage?: number
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          budget_id?: string | null
          cost_total?: number
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          discount?: number
          down_payment?: number
          erp_customer_id?: string | null
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          is_import?: boolean
          name?: string
          order_number?: number
          origin?: string
          payment_method?: string
          sale_date?: string | null
          shipping?: number
          status?: string
          subtotal?: number
          timeline_stage?: number
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "store_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_erp_customer_id_fkey"
            columns: ["erp_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          notes: string
          number: number
          paid_at: string | null
          source_id: string
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          notes?: string
          number: number
          paid_at?: string | null
          source_id: string
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          notes?: string
          number?: number
          paid_at?: string | null
          source_id?: string
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_benchmarks: {
        Row: {
          ajuste: string | null
          coletado_em: string
          condicao: string | null
          config_testada: string
          created_at: string
          fonte: string
          fonte_url: string
          grupo: string
          id: string
          menor_melhor: boolean
          ordem: number
          posicao_ranking: number | null
          product_id: string
          resultado: number
          teste: string
          total_ranking: number | null
          unidade: string
        }
        Insert: {
          ajuste?: string | null
          coletado_em: string
          condicao?: string | null
          config_testada: string
          created_at?: string
          fonte?: string
          fonte_url: string
          grupo: string
          id?: string
          menor_melhor?: boolean
          ordem?: number
          posicao_ranking?: number | null
          product_id: string
          resultado: number
          teste: string
          total_ranking?: number | null
          unidade: string
        }
        Update: {
          ajuste?: string | null
          coletado_em?: string
          condicao?: string | null
          config_testada?: string
          created_at?: string
          fonte?: string
          fonte_url?: string
          grupo?: string
          id?: string
          menor_melhor?: boolean
          ordem?: number
          posicao_ranking?: number | null
          product_id?: string
          resultado?: number
          teste?: string
          total_ranking?: number | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_benchmarks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          product_id: string
        }
        Insert: {
          collection_id: string
          product_id: string
        }
        Update: {
          collection_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          id: string
          label: string
          position: number
          product_id: string
          url: string | null
        }
        Insert: {
          id?: string
          label: string
          position?: number
          product_id: string
          url?: string | null
        }
        Update: {
          id?: string
          label?: string
          position?: number
          product_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_related: {
        Row: {
          product_id: string
          related_id: string
        }
        Insert: {
          product_id: string
          related_id: string
        }
        Update: {
          product_id?: string
          related_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_related_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_related_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specs: {
        Row: {
          id: string
          k: string
          position: number
          product_id: string
          v: string
        }
        Insert: {
          id?: string
          k: string
          position?: number
          product_id: string
          v: string
        }
        Update: {
          id?: string
          k?: string
          position?: number
          product_id?: string
          v?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          base_name: string | null
          brand_id: string | null
          category_id: string | null
          color: string
          condition: string
          cpu: string
          created_at: string
          description: string
          exclusive_us: boolean
          gpu: string
          highlights: string[]
          id: string
          name: string
          position: number
          price: number
          promo_price: number | null
          ram: string
          rating: number
          review_count: number
          screen_type: string
          sku: string
          stock: number
          storage: string
          variant_of: string | null
        }
        Insert: {
          active?: boolean
          base_name?: string | null
          brand_id?: string | null
          category_id?: string | null
          color?: string
          condition?: string
          cpu?: string
          created_at?: string
          description?: string
          exclusive_us?: boolean
          gpu?: string
          highlights?: string[]
          id?: string
          name: string
          position?: number
          price: number
          promo_price?: number | null
          ram?: string
          rating?: number
          review_count?: number
          screen_type?: string
          sku: string
          stock?: number
          storage?: string
          variant_of?: string | null
        }
        Update: {
          active?: boolean
          base_name?: string | null
          brand_id?: string | null
          category_id?: string | null
          color?: string
          condition?: string
          cpu?: string
          created_at?: string
          description?: string
          exclusive_us?: boolean
          gpu?: string
          highlights?: string[]
          id?: string
          name?: string
          position?: number
          price?: number
          promo_price?: number | null
          ram?: string
          rating?: number
          review_count?: number
          screen_type?: string
          sku?: string
          stock?: number
          storage?: string
          variant_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          role: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          phone?: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          role?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          created_at: string
          id: string
          product_id: string
          rating: number
          text: string
        }
        Insert: {
          author_name: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          text: string
        }
        Update: {
          author_name?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_items: {
        Row: {
          amount: number
          billing_type: string
          description: string
          id: string
          internal_service_id: string | null
          lead_time_days: number
          name: string
          order_id: string
          position: number
        }
        Insert: {
          amount?: number
          billing_type?: string
          description?: string
          id?: string
          internal_service_id?: string | null
          lead_time_days?: number
          name: string
          order_id: string
          position?: number
        }
        Update: {
          amount?: number
          billing_type?: string
          description?: string
          id?: string
          internal_service_id?: string | null
          lead_time_days?: number
          name?: string
          order_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_items_internal_service_id_fkey"
            columns: ["internal_service_id"]
            isOneToOne: false
            referencedRelation: "internal_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_activities: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          due_date: string
          id: string
          notes: string | null
          position: number
          service_order_id: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date: string
          id?: string
          notes?: string | null
          position?: number
          service_order_id: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          position?: number
          service_order_id?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_activities_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_activities_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "work_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      work_template_items: {
        Row: {
          day_offset: number
          id: string
          notes: string | null
          position: number
          template_id: string
          title: string
        }
        Insert: {
          day_offset?: number
          id?: string
          notes?: string | null
          position?: number
          template_id: string
          title: string
        }
        Update: {
          day_offset?: number
          id?: string
          notes?: string | null
          position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "work_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      work_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          created_at: string
          customer_id: string | null
          discount_note: string
          discount_type: string
          discount_value: number
          down_payment: number
          due_date: string | null
          first_due_date: string | null
          id: string
          installment_count: number
          installment_notes: string
          interest_pct: number
          lead_time_days: number
          monthly_amount: number
          notes: string
          payment_method: string
          payment_status: string
          plan_months: number | null
          plan_start_date: string | null
          quote_id: string | null
          start_date: string
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          down_payment?: number
          due_date?: string | null
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          lead_time_days?: number
          monthly_amount?: number
          notes?: string
          payment_method?: string
          payment_status?: string
          plan_months?: number | null
          plan_start_date?: string | null
          quote_id?: string | null
          start_date?: string
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          down_payment?: number
          due_date?: string | null
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          lead_time_days?: number
          monthly_amount?: number
          notes?: string
          payment_method?: string
          payment_status?: string
          plan_months?: number | null
          plan_start_date?: string | null
          quote_id?: string | null
          start_date?: string
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quote_items: {
        Row: {
          amount: number
          billing_type: string
          description: string
          id: string
          internal_service_id: string | null
          lead_time_days: number
          name: string
          position: number
          quote_id: string
        }
        Insert: {
          amount?: number
          billing_type?: string
          description?: string
          id?: string
          internal_service_id?: string | null
          lead_time_days?: number
          name: string
          position?: number
          quote_id: string
        }
        Update: {
          amount?: number
          billing_type?: string
          description?: string
          id?: string
          internal_service_id?: string | null
          lead_time_days?: number
          name?: string
          position?: number
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_quote_items_internal_service_id_fkey"
            columns: ["internal_service_id"]
            isOneToOne: false
            referencedRelation: "internal_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quotes: {
        Row: {
          client_has_domain: boolean
          created_at: string
          customer_id: string | null
          discount_note: string
          discount_type: string
          discount_value: number
          id: string
          include_contract: boolean
          lead_time_days: number
          monthly_amount: number
          notes: string
          plan_months: number | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_has_domain?: boolean
          created_at?: string
          customer_id?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          id?: string
          include_contract?: boolean
          lead_time_days?: number
          monthly_amount?: number
          notes?: string
          plan_months?: number | null
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          client_has_domain?: boolean
          created_at?: string
          customer_id?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          id?: string
          include_contract?: boolean
          lead_time_days?: number
          monthly_amount?: number
          notes?: string
          plan_months?: number | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          description: string
          glyph: string
          id: string
          name: string
          position: number
          price_label: string
        }
        Insert: {
          description?: string
          glyph?: string
          id?: string
          name: string
          position?: number
          price_label?: string
        }
        Update: {
          description?: string
          glyph?: string
          id?: string
          name?: string
          position?: number
          price_label?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          contract_forum: string
          contractor_doc: string
          contractor_name: string
          contractor_role: string
          default_delivery_time: string | null
          id: boolean
          sender_address_line: string
          sender_address_number: string
          sender_cep: string
          sender_city: string
          sender_complement: string
          sender_district: string
          sender_doc: string
          sender_name: string
          sender_phone: string
          sender_state: string
          show_small_banners: boolean
          signature_path: string
          usd_rate: number | null
          usd_rate_spread: number
        }
        Insert: {
          contract_forum?: string
          contractor_doc?: string
          contractor_name?: string
          contractor_role?: string
          default_delivery_time?: string | null
          id?: boolean
          sender_address_line?: string
          sender_address_number?: string
          sender_cep?: string
          sender_city?: string
          sender_complement?: string
          sender_district?: string
          sender_doc?: string
          sender_name?: string
          sender_phone?: string
          sender_state?: string
          show_small_banners?: boolean
          signature_path?: string
          usd_rate?: number | null
          usd_rate_spread?: number
        }
        Update: {
          contract_forum?: string
          contractor_doc?: string
          contractor_name?: string
          contractor_role?: string
          default_delivery_time?: string | null
          id?: boolean
          sender_address_line?: string
          sender_address_number?: string
          sender_cep?: string
          sender_city?: string
          sender_complement?: string
          sender_district?: string
          sender_doc?: string
          sender_name?: string
          sender_phone?: string
          sender_state?: string
          show_small_banners?: boolean
          signature_path?: string
          usd_rate?: number | null
          usd_rate_spread?: number
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          budget_id: string | null
          category: string | null
          created_at: string
          entry_date: string | null
          id: string
          name: string
          notes: string | null
          origin: string
          paid_amount: number
          photo_url: string | null
          product_id: string | null
          product_link: string | null
          purchase_date: string | null
          reserved_customer_id: string | null
          sale_amount: number
          specs: string | null
          status: string
          trade_item_id: string | null
          updated_at: string
          usd_rate: number | null
        }
        Insert: {
          budget_id?: string | null
          category?: string | null
          created_at?: string
          entry_date?: string | null
          id?: string
          name: string
          notes?: string | null
          origin?: string
          paid_amount?: number
          photo_url?: string | null
          product_id?: string | null
          product_link?: string | null
          purchase_date?: string | null
          reserved_customer_id?: string | null
          sale_amount?: number
          specs?: string | null
          status?: string
          trade_item_id?: string | null
          updated_at?: string
          usd_rate?: number | null
        }
        Update: {
          budget_id?: string | null
          category?: string | null
          created_at?: string
          entry_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          origin?: string
          paid_amount?: number
          photo_url?: string | null
          product_id?: string | null
          product_link?: string | null
          purchase_date?: string | null
          reserved_customer_id?: string | null
          sale_amount?: number
          specs?: string | null
          status?: string
          trade_item_id?: string | null
          updated_at?: string
          usd_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "store_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_reserved_customer_id_fkey"
            columns: ["reserved_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_quotes: {
        Row: {
          category: string | null
          created_at: string
          customer_id: string | null
          delivery_time: string | null
          discount_note: string
          discount_type: string
          discount_value: number
          grabr_fee_brl: number
          grabr_fee_usd: number
          id: string
          margin_pct: number
          name: string
          notes: string | null
          payment_method: string | null
          processing_brl: number
          processing_usd: number
          product_id: string | null
          product_link: string | null
          product_value_brl: number
          product_value_usd: number
          profit_brl: number
          sale_price_brl: number
          shipping_brl: number
          shipping_usd: number
          specs: string | null
          status: string
          tax_brl: number
          tax_usd: number
          total_brl: number
          total_usd: number
          traveler_fee_brl: number
          traveler_fee_usd: number
          updated_at: string
          usd_rate: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_time?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          grabr_fee_brl?: number
          grabr_fee_usd?: number
          id?: string
          margin_pct?: number
          name: string
          notes?: string | null
          payment_method?: string | null
          processing_brl?: number
          processing_usd?: number
          product_id?: string | null
          product_link?: string | null
          product_value_brl?: number
          product_value_usd?: number
          profit_brl?: number
          sale_price_brl?: number
          shipping_brl?: number
          shipping_usd?: number
          specs?: string | null
          status?: string
          tax_brl?: number
          tax_usd?: number
          total_brl?: number
          total_usd?: number
          traveler_fee_brl?: number
          traveler_fee_usd?: number
          updated_at?: string
          usd_rate: number
        }
        Update: {
          category?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_time?: string | null
          discount_note?: string
          discount_type?: string
          discount_value?: number
          grabr_fee_brl?: number
          grabr_fee_usd?: number
          id?: string
          margin_pct?: number
          name?: string
          notes?: string | null
          payment_method?: string | null
          processing_brl?: number
          processing_usd?: number
          product_id?: string | null
          product_link?: string | null
          product_value_brl?: number
          product_value_usd?: number
          profit_brl?: number
          sale_price_brl?: number
          shipping_brl?: number
          shipping_usd?: number
          specs?: string | null
          status?: string
          tax_brl?: number
          tax_usd?: number
          total_brl?: number
          total_usd?: number
          traveler_fee_brl?: number
          traveler_fee_usd?: number
          updated_at?: string
          usd_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_quotes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_pieces: {
        Row: {
          conteudo: Json
          created_at: string
          formato: string
          id: string
          legenda: string
          modelo: string
          position: number
          product_id: string | null
          resposta_direta: string
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          formato: string
          id?: string
          legenda?: string
          modelo: string
          position?: number
          product_id?: string | null
          resposta_direta?: string
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          formato?: string
          id?: string
          legenda?: string
          modelo?: string
          position?: number
          product_id?: string | null
          resposta_direta?: string
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_pieces_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_publications: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          imagens: string[]
          legenda: string
          media_id: string | null
          permalink: string | null
          piece_id: string
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          imagens?: string[]
          legenda?: string
          media_id?: string | null
          permalink?: string | null
          piece_id: string
          status?: string
          tipo: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          imagens?: string[]
          legenda?: string
          media_id?: string | null
          permalink?: string | null
          piece_id?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_publications_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "studio_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_perfil_diario: {
        Row: {
          atualizado_em: string
          dia: string
          posts: number
          seguidores: number
          seguindo: number
        }
        Insert: {
          atualizado_em?: string
          dia: string
          posts?: number
          seguidores: number
          seguindo?: number
        }
        Update: {
          atualizado_em?: string
          dia?: string
          posts?: number
          seguidores?: number
          seguindo?: number
        }
        Relationships: []
      }
      studio_posts: {
        Row: {
          atualizado_em: string
          comentarios_lidos: number
          media_id: string
          palavra: string
          piece_id: string | null
          resposta: string
        }
        Insert: {
          atualizado_em?: string
          comentarios_lidos?: number
          media_id: string
          palavra?: string
          piece_id?: string | null
          resposta?: string
        }
        Update: {
          atualizado_em?: string
          comentarios_lidos?: number
          media_id?: string
          palavra?: string
          piece_id?: string | null
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_posts_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "studio_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_respostas: {
        Row: {
          comentado_em: string
          comment_id: string
          created_at: string
          id: string
          media_id: string
          palavra: string
          respondido_em: string | null
          texto: string
          usuario: string
        }
        Insert: {
          comentado_em: string
          comment_id: string
          created_at?: string
          id?: string
          media_id: string
          palavra?: string
          respondido_em?: string | null
          texto?: string
          usuario: string
        }
        Update: {
          comentado_em?: string
          comment_id?: string
          created_at?: string
          id?: string
          media_id?: string
          palavra?: string
          respondido_em?: string | null
          texto?: string
          usuario?: string
        }
        Relationships: []
      }
      studio_topics: {
        Row: {
          created_at: string
          fonte: string
          id: string
          marcas: string[]
          publicado_em: string | null
          relevancia: number
          resumo: string
          resumo_pt: string | null
          status: string
          titulo: string
          titulo_pt: string | null
          url: string
        }
        Insert: {
          created_at?: string
          fonte: string
          id?: string
          marcas?: string[]
          publicado_em?: string | null
          relevancia?: number
          resumo?: string
          resumo_pt?: string | null
          status?: string
          titulo: string
          titulo_pt?: string | null
          url: string
        }
        Update: {
          created_at?: string
          fonte?: string
          id?: string
          marcas?: string[]
          publicado_em?: string | null
          relevancia?: number
          resumo?: string
          resumo_pt?: string | null
          status?: string
          titulo?: string
          titulo_pt?: string | null
          url?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          bought: string
          created_at: string
          id: string
          name: string
          position: number
          text: string
        }
        Insert: {
          bought?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          text: string
        }
        Update: {
          bought?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          text?: string
        }
        Relationships: []
      }
      trade_items: {
        Row: {
          category: string
          condition: string
          id: string
          market_value: number
          name: string
          notes: string
          paid_value: number
          position: number
          resale_value: number
          specs: string
          stock_item_id: string | null
          trade_id: string
        }
        Insert: {
          category?: string
          condition?: string
          id?: string
          market_value?: number
          name: string
          notes?: string
          paid_value?: number
          position?: number
          resale_value?: number
          specs?: string
          stock_item_id?: string | null
          trade_id: string
        }
        Update: {
          category?: string
          condition?: string
          id?: string
          market_value?: number
          name?: string
          notes?: string
          paid_value?: number
          position?: number
          resale_value?: number
          specs?: string
          stock_item_id?: string | null
          trade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_items_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_items_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          created_at: string
          customer_id: string | null
          difference_to_pay: number
          down_payment: number
          first_due_date: string | null
          id: string
          installment_count: number
          installment_notes: string
          interest_pct: number
          main_cost: number
          main_product_name: string
          main_sale_price: number
          margin_pct: number
          notes: string
          order_id: string | null
          payment_method: string
          stock_item_id: string | null
          total_profit: number
          total_received: number
          trade_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          difference_to_pay?: number
          down_payment?: number
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          main_cost?: number
          main_product_name: string
          main_sale_price?: number
          margin_pct?: number
          notes?: string
          order_id?: string | null
          payment_method?: string
          stock_item_id?: string | null
          total_profit?: number
          total_received?: number
          trade_date?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          difference_to_pay?: number
          down_payment?: number
          first_due_date?: string | null
          id?: string
          installment_count?: number
          installment_notes?: string
          interest_pct?: number
          main_cost?: number
          main_product_name?: string
          main_sale_price?: number
          margin_pct?: number
          notes?: string
          order_id?: string | null
          payment_method?: string
          stock_item_id?: string | null
          total_profit?: number
          total_received?: number
          trade_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ia_gasto_por_conversa: {
        Row: {
          chamadas: number | null
          conversation_id: string | null
          custo_usd: number | null
        }
        Relationships: []
      }
      ia_gasto_por_mes: {
        Row: {
          chamadas: number | null
          custo_usd: number | null
          mes: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      keepalive: { Args: never; Returns: string }
      validar_cupom: { Args: { p_codigo: string }; Returns: number | null }
      vitrine_settings: {
        Args: never
        Returns: {
          show_small_banners: boolean
        }[]
      }
      check_assistant_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      lead_diagnostico: {
        Args: { p_kit?: string; p_token: string }
        Returns: Json
      }
      lead_registrar_visita: { Args: { p_token: string }; Returns: undefined }
      lead_kit: { Args: { p_token: string }; Returns: Json }
      lead_kit_meta: { Args: { p_token: string }; Returns: Json }
      lead_kit_atualizar: {
        Args: {
          p_etapa?: number
          p_lead: string
          p_nota?: string
          p_status?: string
          p_token: string
        }
        Returns: string
      }
      lead_kit_pedir_mais: { Args: { p_token: string }; Returns: string }
      lead_kit_descoberta: {
        Args: { p_dados: Json; p_lead: string; p_token: string }
        Returns: string
      }
      my_installments: {
        Args: never
        Returns: {
          amount: number
          due_date: string
          id: string
          number: number
          origem: string
          paid_at: string
          source_type: string
          status: string
        }[]
      }
      next_order_number: { Args: never; Returns: number }
      ready_stock_counts: {
        Args: never
        Returns: {
          product_id: string
          qty: number
        }[]
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
    Enums: {},
  },
} as const
