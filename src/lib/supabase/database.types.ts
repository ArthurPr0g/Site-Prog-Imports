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
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          qty?: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
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
          coupon_code: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          discount: number
          id: string
          is_import: boolean
          order_number: number
          payment_method: string
          shipping: number
          status: string
          subtotal: number
          timeline_stage: number
          total: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          address_snapshot?: Json | null
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          discount?: number
          id?: string
          is_import?: boolean
          order_number: number
          payment_method?: string
          shipping?: number
          status?: string
          subtotal?: number
          timeline_stage?: number
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          address_snapshot?: Json | null
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          discount?: number
          id?: string
          is_import?: boolean
          order_number?: number
          payment_method?: string
          shipping?: number
          status?: string
          subtotal?: number
          timeline_stage?: number
          total?: number
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
      site_settings: {
        Row: {
          default_delivery_time: string | null
          id: boolean
          show_small_banners: boolean
          usd_rate: number | null
        }
        Insert: {
          default_delivery_time?: string | null
          id?: boolean
          show_small_banners?: boolean
          usd_rate?: number | null
        }
        Update: {
          default_delivery_time?: string | null
          id?: boolean
          show_small_banners?: boolean
          usd_rate?: number | null
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
