// Hand-written Supabase types mirroring /supabase/migrations.
// Replace with generator output once the project is linked:
//   supabase gen types typescript --project-id <ref> > lib/supabase/types.ts

export type UserRole = "host" | "neighbor" | "admin" | "super_admin";
export type KycStatus = "pending" | "verified" | "rejected";

export type PathInterest = "full_stack" | "upgrade" | "either";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "rejected";

export type InstallationType = "full_stack" | "upgrade";
export type SiteStatus = "pending" | "installing" | "active" | "paused" | "decommissioned";

export type GatewayStatus = "provisioned" | "online" | "offline" | "faulty";

export type MeterType = "host" | "neighbor";
export type MeterStatus = "active" | "disconnected" | "faulty" | "removed";

export type ConnectionStatus = "active" | "suspended" | "ended" | "pending";

export type TransactionType =
  | "topup"
  | "consumption"
  | "withdrawal"
  | "platform_fee"
  | "installment"
  | "refund";
export type TransactionStatus = "pending" | "success" | "failed";

export type InstallmentStatus = "pending" | "paid" | "overdue" | "defaulted";

export type DisputeCategory = "billing" | "disconnect" | "meter_fault" | "pricing" | "other";
export type DisputeStatus = "open" | "investigating" | "resolved" | "rejected";

type Iso = string;
type Uuid = string;
type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface Profile {
  id: Uuid;
  role: UserRole;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  kyc_status: KycStatus;
  kyc_documents: Json | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface Lead {
  id: Uuid;
  name: string;
  phone: string;
  email: string;
  address: string | null;
  lagos_area: string | null;
  path_interest: PathInterest;
  source: string;
  status: LeadStatus;
  notes: string | null;
  assigned_to: Uuid | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface Site {
  id: Uuid;
  host_id: Uuid;
  address: string;
  lagos_area: string | null;
  coordinates: string | null;
  installation_type: InstallationType;
  solar_capacity_kw: number;
  battery_capacity_kwh: number;
  installed_at: Iso | null;
  status: SiteStatus;
  created_at: Iso;
  updated_at: Iso;
}

export interface Gateway {
  id: Uuid;
  site_id: Uuid;
  serial_number: string;
  hardware_version: string | null;
  firmware_version: string | null;
  last_seen_at: Iso | null;
  status: GatewayStatus;
  cert_fingerprint: string | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface Meter {
  id: Uuid;
  gateway_id: Uuid;
  user_id: Uuid;
  serial_number: string;
  meter_type: MeterType;
  installed_at: Iso | null;
  status: MeterStatus;
  last_reading_kwh: number | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface Connection {
  id: Uuid;
  host_id: Uuid;
  neighbor_id: Uuid | null;
  meter_id: Uuid;
  current_price_per_kwh: number;
  status: ConnectionStatus;
  pending_phone: string | null;
  started_at: Iso;
  ended_at: Iso | null;
  created_at: Iso;
  updated_at: Iso;
}

/** Balance/amount fields are in KOBO (1 NGN = 100 kobo), stored as numeric. */
export interface Wallet {
  id: Uuid;
  user_id: Uuid;
  balance: number;
  updated_at: Iso;
}

export interface Transaction {
  id: Uuid;
  wallet_id: Uuid;
  type: TransactionType;
  amount: number;
  reference: string | null;
  connection_id: Uuid | null;
  kwh_consumed: number | null;
  metadata: Json;
  status: TransactionStatus;
  created_at: Iso;
}

export interface TelemetryRow {
  id: number;
  meter_id: Uuid;
  kwh_cumulative: number;
  voltage: number | null;
  current: number | null;
  power_factor: number | null;
  timestamp: Iso;
}

export interface Installment {
  id: Uuid;
  site_id: Uuid;
  total_amount: number;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_at: Iso | null;
  status: InstallmentStatus;
  created_at: Iso;
}

export interface Dispute {
  id: Uuid;
  raised_by: Uuid;
  connection_id: Uuid;
  category: DisputeCategory;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  resolved_by: Uuid | null;
  created_at: Iso;
  resolved_at: Iso | null;
  updated_at: Iso;
}

export interface Notification {
  id: Uuid;
  user_id: Uuid;
  type: string;
  title: string;
  body: string;
  data: Json;
  read_at: Iso | null;
  created_at: Iso;
}

export interface OtpChallenge {
  id: Uuid;
  phone: string;
  code_hash: string;
  expires_at: Iso;
  consumed_at: Iso | null;
  created_at: Iso;
}

type Insert<T, NotNullKey extends keyof T = never> =
  Partial<T> & Pick<T, NotNullKey>;

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Insert<Profile, "id">; Update: Partial<Profile> };
      leads: { Row: Lead; Insert: Insert<Lead, "name" | "phone" | "email">; Update: Partial<Lead> };
      sites: {
        Row: Site;
        Insert: Insert<Site, "host_id" | "address" | "installation_type" | "solar_capacity_kw" | "battery_capacity_kwh">;
        Update: Partial<Site>;
      };
      gateways: { Row: Gateway; Insert: Insert<Gateway, "site_id" | "serial_number">; Update: Partial<Gateway> };
      meters: {
        Row: Meter;
        Insert: Insert<Meter, "gateway_id" | "user_id" | "serial_number" | "meter_type">;
        Update: Partial<Meter>;
      };
      connections: {
        Row: Connection;
        Insert: Insert<Connection, "host_id" | "neighbor_id" | "meter_id" | "current_price_per_kwh">;
        Update: Partial<Connection>;
      };
      wallets: { Row: Wallet; Insert: Insert<Wallet, "user_id">; Update: Partial<Wallet> };
      transactions: {
        Row: Transaction;
        Insert: Insert<Transaction, "wallet_id" | "type" | "amount">;
        Update: Partial<Transaction>;
      };
      telemetry: {
        Row: TelemetryRow;
        Insert: Insert<TelemetryRow, "meter_id" | "kwh_cumulative" | "timestamp">;
        Update: Partial<TelemetryRow>;
      };
      installments: {
        Row: Installment;
        Insert: Insert<Installment, "site_id" | "total_amount" | "installment_number" | "amount" | "due_date">;
        Update: Partial<Installment>;
      };
      disputes: {
        Row: Dispute;
        Insert: Insert<Dispute, "raised_by" | "connection_id" | "category" | "description">;
        Update: Partial<Dispute>;
      };
      notifications: {
        Row: Notification;
        Insert: Insert<Notification, "user_id" | "type" | "title" | "body">;
        Update: Partial<Notification>;
      };
      otp_challenges: {
        Row: OtpChallenge;
        Insert: Insert<OtpChallenge, "phone" | "code_hash" | "expires_at">;
        Update: Partial<OtpChallenge>;
      };
    };
    Functions: {
      process_consumption: {
        Args: { p_meter_id: Uuid; p_kwh_delta: number };
        Returns: number;
      };
      top_up_wallet: {
        Args: { p_user_id: Uuid; p_amount_kobo: number; p_reference: string };
        Returns: number;
      };
      initiate_withdrawal: {
        Args: { p_user_id: Uuid; p_amount_kobo: number };
        Returns: Uuid;
      };
      connect_neighbor: {
        Args: {
          p_host_id: Uuid;
          p_neighbor_phone: string;
          p_meter_id: Uuid;
          p_price_per_kwh: number;
        };
        Returns: Uuid;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      create_telemetry_partition: { Args: { p_day: string }; Returns: void };
    };
    Enums: {
      user_role: UserRole;
      kyc_status: KycStatus;
      path_interest: PathInterest;
      lead_status: LeadStatus;
      installation_type: InstallationType;
      site_status: SiteStatus;
      gateway_status: GatewayStatus;
      meter_type: MeterType;
      meter_status: MeterStatus;
      connection_status: ConnectionStatus;
      transaction_type: TransactionType;
      transaction_status: TransactionStatus;
      installment_status: InstallmentStatus;
      dispute_category: DisputeCategory;
      dispute_status: DisputeStatus;
    };
  };
}
