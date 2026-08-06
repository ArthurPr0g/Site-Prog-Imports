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
          trade_id: string | null
          tracking_code: string | null
          tracking_url: string | null
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
          trade_id?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
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
          trade_id?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          exclusive_us: boolean
          brand_id: string | null
          category_id: string | null
          color: string
          condition: string
          cpu: string
          created_at: string
          description: string
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
          exclusive_us?: boolean
          brand_id?: string | null
          category_id?: string | null
          color?: string
          condition?: string
          cpu?: string
          created_at?: string
          description?: string
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
          exclusive_us?: boolean
          brand_id?: string | null
          category_id?: string | null
          color?: string
          condition?: string
          cpu?: string
          created_at?: string
          description?: string
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
      store_quotes: {
        Row: {
          category: string | null
          discount_note: string
          discount_type: string
          discount_value: number
          created_at: string
          customer_id: string | null
          delivery_time: string | null
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
          discount_note?: string
          discount_type?: string
          discount_value?: number
          created_at?: string
          customer_id?: string | null
          delivery_time?: string | null
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
          discount_note?: string
          discount_type?: string
          discount_value?: number
          created_at?: string
          customer_id?: string | null
          delivery_time?: string | null
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
          discount_note: string
          discount_type: string
          discount_value: number
          customer_id: string | null
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
          discount_note?: string
          discount_type?: string
          discount_value?: number
          customer_id?: string | null
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
          discount_note?: string
          discount_type?: string
          discount_value?: number
          customer_id?: string | null
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
      site_settings: {
        Row: {
          contract_forum: string
          signature_path: string
          sender_name: string
          sender_doc: string
          sender_phone: string
          sender_cep: string
          sender_address_line: string
          sender_address_number: string
          sender_complement: string
          sender_district: string
          sender_city: string
          sender_state: string
          contractor_doc: string
          contractor_name: string
          contractor_role: string
          default_delivery_time: string | null
          id: boolean
          show_small_banners: boolean
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
          signature_path?: string
          sender_name?: string
          sender_doc?: string
          sender_phone?: string
          sender_cep?: string
          sender_address_line?: string
          sender_address_number?: string
          sender_complement?: string
          sender_district?: string
          sender_city?: string
          sender_state?: string
          show_small_banners?: boolean
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
          signature_path?: string
          sender_name?: string
          sender_doc?: string
          sender_phone?: string
          sender_cep?: string
          sender_address_line?: string
          sender_address_number?: string
          sender_complement?: string
          sender_district?: string
          sender_city?: string
          sender_state?: string
          show_small_banners?: boolean
          usd_rate?: number | null
          usd_rate_spread?: number
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      next_order_number: { Args: never; Returns: number }
      ready_stock_counts: {
        Args: never
        Returns: { product_id: string; qty: number }[]
      }
      check_assistant_rate_limit: {
        Args: { p_key: string; p_window_seconds: number; p_limit: number }
        Returns: boolean
      }
      my_installments: {
        Args: never
        Returns: {
          id: string
          source_type: string
          number: number
          amount: number
          due_date: string
          status: string
          paid_at: string | null
          origem: string | null
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
