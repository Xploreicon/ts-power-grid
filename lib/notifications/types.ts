/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export type NotificationChannel = "in_app" | "push" | "sms" | "whatsapp" | "email";

export type EventType =
  // Host
  | "neighbor_topup_received"
  | "neighbor_disconnected"
  | "daily_earnings_summary"
  | "system_health_alert"
  | "installment_due_reminder"
  | "withdrawal_confirmation"
  | "dispute_raised_against"
  | "dispute_resolution"
  // Neighbor
  | "welcome_connection"
  | "topup_confirmation"
  | "low_balance_warning"
  | "disconnect_notification"
  | "reconnect_confirmation"
  | "daily_usage_summary"
  | "price_change_by_host"
  // Admin
  | "new_lead_submitted"
  | "high_priority_dispute"
  | "gateway_offline_prolonged"
  | "installment_overdue"
  | "system_fault_reported"
  | "large_withdrawal_request"
  | "kyc_submission_pending";

export interface NotificationPayload {
  userId: string;
  eventType: EventType;
  data: Record<string, any>;
}

export interface RenderedNotification {
  in_app?: { title: string; body: string; url?: string };
  push?: { title: string; body: string; url?: string };
  sms?: { body: string };
  whatsapp?: { templateName: string; parameters: string[] };
  email?: { subject: string; component: React.ReactElement };
}

export type TemplateRenderer = (data: Record<string, any>) => RenderedNotification;
