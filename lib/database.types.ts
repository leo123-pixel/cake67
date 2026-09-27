// Hand-written mirror of supabase/migrations until the project exists.
// Replace with: supabase gen types typescript --linked > lib/database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          slug: string;
          name: string;
          address: string;
          phone: string | null;
          whatsapp: string;
          hours: Json;
          active: boolean;
          sort: number;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          address: string;
          phone?: string | null;
          whatsapp: string;
          hours?: Json;
          active?: boolean;
          sort?: number;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          kind: Database["public"]["Enums"]["category_kind"];
          sort: number;
          active: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          kind: Database["public"]["Enums"]["category_kind"];
          sort?: number;
          active?: boolean;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          slug: string;
          name: string;
          description: string;
          type: Database["public"]["Enums"]["product_type"];
          price_cents: number;
          price_pending: boolean;
          active: boolean;
          featured: boolean;
          sort: number;
          min_qty: number | null;
          step_qty: number | null;
          lead_time_hours: number;
          weights_kg: number[];
          formats: string[];
          kit_contents: string | null;
          store_ids: string[];
        } & Timestamps;
        Insert: {
          id?: string;
          category_id: string;
          slug: string;
          name: string;
          description?: string;
          type: Database["public"]["Enums"]["product_type"];
          price_cents: number;
          price_pending?: boolean;
          active?: boolean;
          featured?: boolean;
          sort?: number;
          min_qty?: number | null;
          step_qty?: number | null;
          lead_time_hours?: number;
          weights_kg?: number[];
          formats?: string[];
          kit_contents?: string | null;
          store_ids?: string[];
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          path: string;
          alt: string;
          sort: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          path: string;
          alt?: string;
          sort?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      addons: {
        Row: {
          id: string;
          name: string;
          price_cents: number;
          active: boolean;
          sort: number;
        } & Timestamps;
        Insert: {
          id?: string;
          name: string;
          price_cents: number;
          active?: boolean;
          sort?: number;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["addons"]["Insert"]>;
        Relationships: [];
      };
      product_addons: {
        Row: { product_id: string; addon_id: string };
        Insert: { product_id: string; addon_id: string };
        Update: { product_id?: string; addon_id?: string };
        Relationships: [
          {
            foreignKeyName: "product_addons_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_addons_addon_id_fkey";
            columns: ["addon_id"];
            isOneToOne: false;
            referencedRelation: "addons";
            referencedColumns: ["id"];
          },
        ];
      };
      stock: {
        Row: { product_id: string; store_id: string; quantity: number; updated_at: string };
        Insert: { product_id: string; store_id: string; quantity?: number; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["stock"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          code: string;
          public_token: string;
          store_id: string;
          status: Database["public"]["Enums"]["order_status"];
          expires_at: string | null;
          customer_name: string;
          customer_whatsapp: string;
          notes: string | null;
          fulfillment: Database["public"]["Enums"]["fulfillment"];
          delivery_address: string | null;
          scheduled_for: string | null;
          subtotal_cents: number;
          has_made_to_order: boolean;
          confirmed_at: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
          handled_by: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          code?: string;
          public_token?: string;
          store_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          expires_at?: string | null;
          customer_name: string;
          customer_whatsapp: string;
          notes?: string | null;
          fulfillment: Database["public"]["Enums"]["fulfillment"];
          delivery_address?: string | null;
          scheduled_for?: string | null;
          subtotal_cents: number;
          has_made_to_order?: boolean;
          confirmed_at?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          handled_by?: string | null;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          name_snapshot: string;
          type: Database["public"]["Enums"]["product_type"];
          qty: number;
          unit_price_cents: number;
          total_cents: number;
          options: Json;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          name_snapshot: string;
          type: Database["public"]["Enums"]["product_type"];
          qty: number;
          unit_price_cents: number;
          total_cents: number;
          options?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: number;
          product_id: string;
          store_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          order_id: string | null;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          product_id: string;
          store_id: string;
          delta: number;
          reason: Database["public"]["Enums"]["stock_reason"];
          order_id?: string | null;
          user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stock_movements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          user_id: string;
          name: string;
          role: Database["public"]["Enums"]["staff_role"];
          store_id: string | null;
          active: boolean;
        } & Timestamps;
        Insert: {
          user_id: string;
          name: string;
          role: Database["public"]["Enums"]["staff_role"];
          store_id?: string | null;
          active?: boolean;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "staff_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      highlights: {
        Row: {
          id: string;
          slot: Database["public"]["Enums"]["highlight_slot"];
          product_id: string | null;
          title: string;
          subtitle: string | null;
          image_path: string | null;
          cta_label: string | null;
          cta_href: string | null;
          starts_at: string | null;
          ends_at: string | null;
          active: boolean;
          sort: number;
        } & Timestamps;
        Insert: {
          id?: string;
          slot: Database["public"]["Enums"]["highlight_slot"];
          product_id?: string | null;
          title: string;
          subtitle?: string | null;
          image_path?: string | null;
          cta_label?: string | null;
          cta_href?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          active?: boolean;
          sort?: number;
        } & Partial<Timestamps>;
        Update: Partial<Database["public"]["Tables"]["highlights"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "highlights_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          id: number;
          reservation_minutes: number;
          order_whatsapp_template: string;
          privacy_text: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          reservation_minutes?: number;
          order_whatsapp_template: string;
          privacy_text?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      product_availability: {
        Row: {
          product_id: string | null;
          store_id: string | null;
          available: boolean | null;
          quantity: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
      staff_store: { Args: never; Returns: string };
    };
    Enums: {
      category_kind: "vitrine" | "encomenda";
      product_type: "vitrine" | "bolo_kg" | "cento" | "kit";
      stock_reason: "ajuste" | "reserva" | "devolucao" | "venda";
      order_status:
        | "novo"
        | "confirmado"
        | "em_producao"
        | "pronto"
        | "entregue"
        | "cancelado"
        | "expirado";
      fulfillment: "retirada" | "entrega";
      staff_role: "admin" | "atendente";
      highlight_slot: "bolo_do_mes" | "combo_semana" | "banner";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"]> =
  T extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][T]["Row"]
    : T extends keyof PublicSchema["Views"]
      ? PublicSchema["Views"][T]["Row"]
      : never;

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
