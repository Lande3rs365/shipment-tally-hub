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
      companies: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_intake_logs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_details: Json | null
          error_rows: number
          file_name: string
          file_path: string | null
          file_type: string | null
          id: string
          processed_rows: number
          source_type: string | null
          started_at: string | null
          status: string
          total_rows: number | null
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_rows?: number
          file_name: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          processed_rows?: number
          source_type?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          error_rows?: number
          file_name?: string
          file_path?: string | null
          file_type?: string | null
          id?: string
          processed_rows?: number
          source_type?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_intake_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      exceptions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          exception_type: string
          follow_up_due_at: string | null
          id: string
          linked_manifest_id: string | null
          linked_order_id: string | null
          linked_return_id: string | null
          linked_shipment_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          exception_type: string
          follow_up_due_at?: string | null
          id?: string
          linked_manifest_id?: string | null
          linked_order_id?: string | null
          linked_return_id?: string | null
          linked_shipment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          exception_type?: string
          follow_up_due_at?: string | null
          id?: string
          linked_manifest_id?: string | null
          linked_order_id?: string | null
          linked_return_id?: string | null
          linked_shipment_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_linked_manifest_id_fkey"
            columns: ["linked_manifest_id"]
            isOneToOne: false
            referencedRelation: "manufacturer_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_linked_return_id_fkey"
            columns: ["linked_return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          allocated: number
          available: number
          company_id: string
          damaged: number
          id: string
          location_id: string
          on_hand: number
          product_id: string
          reserved: number
          updated_at: string
        }
        Insert: {
          allocated?: number
          available?: number
          company_id: string
          damaged?: number
          id?: string
          location_id: string
          on_hand?: number
          product_id: string
          reserved?: number
          updated_at?: string
        }
        Update: {
          allocated?: number
          available?: number
          company_id?: string
          damaged?: number
          id?: string
          location_id?: string
          on_hand?: number
          product_id?: string
          reserved?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          expires_at: string
          id: string
          invite_code: string
          invited_by: string
          invitee_email: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by: string
          invitee_email: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by?: string
          invitee_email?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturer_manifest_items: {
        Row: {
          damaged_qty: number
          expected_qty: number
          id: string
          manifest_id: string
          product_id: string | null
          received_qty: number
          short_qty: number
          sku: string | null
          status: string
        }
        Insert: {
          damaged_qty?: number
          expected_qty?: number
          id?: string
          manifest_id: string
          product_id?: string | null
          received_qty?: number
          short_qty?: number
          sku?: string | null
          status?: string
        }
        Update: {
          damaged_qty?: number
          expected_qty?: number
          id?: string
          manifest_id?: string
          product_id?: string | null
          received_qty?: number
          short_qty?: number
          sku?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "manufacturer_manifest_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manufacturer_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturer_manifest_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturer_manifests: {
        Row: {
          company_id: string
          created_at: string
          eta: string | null
          expected_date: string | null
          id: string
          location_id: string | null
          manifest_number: string | null
          manufacturer_name: string
          notes: string | null
          received_date: string | null
          request_date: string | null
          shipment_date: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          eta?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          manifest_number?: string | null
          manufacturer_name: string
          notes?: string | null
          received_date?: string | null
          request_date?: string | null
          shipment_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          eta?: string | null
          expected_date?: string | null
          id?: string
          location_id?: string | null
          manifest_number?: string | null
          manufacturer_name?: string
          notes?: string | null
          received_date?: string | null
          request_date?: string | null
          shipment_date?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manufacturer_manifests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturer_manifests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          order_id?: string
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
          line_total: number | null
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          unit_price: number | null
        }
        Insert: {
          id?: string
          line_total?: number | null
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          unit_price?: number | null
        }
        Update: {
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          unit_price?: number | null
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
          company_id: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          order_date: string | null
          order_number: string
          shipping_address: string | null
          source: string | null
          status: string
          total_amount: number | null
          updated_at: string
          woo_status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_date?: string | null
          order_number: string
          shipping_address?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
          woo_status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          order_date?: string | null
          order_number?: string
          shipping_address?: string | null
          source?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
          woo_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          reorder_point: number
          reorder_qty: number
          sale_price: number | null
          sku: string
          unit_cost: number | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          reorder_point?: number
          reorder_qty?: number
          sale_price?: number | null
          sku: string
          unit_cost?: number | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reorder_point?: number
          reorder_qty?: number
          sale_price?: number | null
          sku?: string
          unit_cost?: number | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      returns: {
        Row: {
          company_id: string
          condition: string | null
          created_at: string
          id: string
          initiated_date: string | null
          notes: string | null
          order_id: string | null
          outcome_location_id: string | null
          product_id: string | null
          reason: string | null
          received_date: string | null
          refund_amount: number | null
          resolution: string | null
          resolved_date: string | null
          return_number: string | null
          return_qty: number | null
          sku: string | null
          status: string
          stock_outcome: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          condition?: string | null
          created_at?: string
          id?: string
          initiated_date?: string | null
          notes?: string | null
          order_id?: string | null
          outcome_location_id?: string | null
          product_id?: string | null
          reason?: string | null
          received_date?: string | null
          refund_amount?: number | null
          resolution?: string | null
          resolved_date?: string | null
          return_number?: string | null
          return_qty?: number | null
          sku?: string | null
          status?: string
          stock_outcome?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          condition?: string | null
          created_at?: string
          id?: string
          initiated_date?: string | null
          notes?: string | null
          order_id?: string | null
          outcome_location_id?: string | null
          product_id?: string | null
          reason?: string | null
          received_date?: string | null
          refund_amount?: number | null
          resolution?: string | null
          resolved_date?: string | null
          return_number?: string | null
          return_qty?: number | null
          sku?: string | null
          status?: string
          stock_outcome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_outcome_location_id_fkey"
            columns: ["outcome_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          id: string
          order_item_id: string | null
          product_id: string | null
          quantity: number
          shipment_id: string
        }
        Insert: {
          id?: string
          order_item_id?: string | null
          product_id?: string | null
          quantity?: number
          shipment_id: string
        }
        Update: {
          id?: string
          order_item_id?: string | null
          product_id?: string | null
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          company_id: string
          created_at: string
          delivered_date: string | null
          id: string
          order_id: string
          shipment_number: string | null
          shipped_date: string | null
          shipping_cost: number | null
          status: string
          tracking_number: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          carrier?: string | null
          company_id: string
          created_at?: string
          delivered_date?: string | null
          id?: string
          order_id: string
          shipment_number?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: string | null
          company_id?: string
          created_at?: string
          delivered_date?: string | null
          id?: string
          order_id?: string
          shipment_number?: string | null
          shipped_date?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          location_type: string
          name: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: string
          name: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_type?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          direction: string
          from_location_id: string | null
          id: string
          linked_manifest_id: string | null
          linked_order_id: string | null
          linked_return_id: string | null
          linked_shipment_id: string | null
          movement_type: string
          notes: string | null
          performed_by: string | null
          product_id: string
          quantity: number
          reason_code: string | null
          sku: string | null
          timestamp: string
          to_location_id: string | null
        }
        Insert: {
          company_id: string
          direction: string
          from_location_id?: string | null
          id?: string
          linked_manifest_id?: string | null
          linked_order_id?: string | null
          linked_return_id?: string | null
          linked_shipment_id?: string | null
          movement_type: string
          notes?: string | null
          performed_by?: string | null
          product_id: string
          quantity: number
          reason_code?: string | null
          sku?: string | null
          timestamp?: string
          to_location_id?: string | null
        }
        Update: {
          company_id?: string
          direction?: string
          from_location_id?: string | null
          id?: string
          linked_manifest_id?: string | null
          linked_order_id?: string | null
          linked_return_id?: string | null
          linked_shipment_id?: string | null
          movement_type?: string
          notes?: string | null
          performed_by?: string | null
          product_id?: string
          quantity?: number
          reason_code?: string | null
          sku?: string | null
          timestamp?: string
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_linked_manifest_id_fkey"
            columns: ["linked_manifest_id"]
            isOneToOne: false
            referencedRelation: "manufacturer_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_linked_return_id_fkey"
            columns: ["linked_return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_linked_shipment_id_fkey"
            columns: ["linked_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation_by_code: { Args: { _code: string }; Returns: Json }
      accept_invitation_by_token: { Args: { _token: string }; Returns: Json }
      create_company_with_owner: {
        Args: {
          _company_code: string
          _company_id: string
          _company_name: string
        }
        Returns: undefined
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
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
