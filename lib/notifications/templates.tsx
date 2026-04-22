/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import * as React from "react";
import { type EventType, type TemplateRenderer } from "./types";
import { DefaultEmail } from "./email-components";

export const TEMPLATES: Record<EventType, TemplateRenderer> = {
  // --- HOST ---
  neighbor_topup_received: (data) => ({
    in_app: {
      title: "Top-up received",
      body: `${data.neighborName ?? "A neighbor"} topped up ₦${data.amount ?? "0"}.`,
      url: `/host/earnings`,
    },
    push: {
      title: "Top-up received ⚡",
      body: `${data.neighborName ?? "A neighbor"} topped up ₦${data.amount ?? "0"}.`,
      url: `/host/earnings`,
    },
  }),
  neighbor_disconnected: (data) => ({
    in_app: {
      title: "Neighbor disconnected",
      body: `${data.neighborName ?? "A neighbor"} ran out of credit and was disconnected.`,
    },
    push: {
      title: "Neighbor disconnected",
      body: `${data.neighborName ?? "A neighbor"}'s connection was paused.`,
    },
  }),
  daily_earnings_summary: (data) => ({
    in_app: {
      title: "Daily Earnings",
      body: `You earned ₦${data.amount ?? "0"} today.`,
      url: `/host/earnings`,
    },
    push: {
      title: "Daily Earnings",
      body: `You earned ₦${data.amount ?? "0"} today. Great job!`,
      url: `/host/earnings`,
    },
  }),
  system_health_alert: (data) => ({
    in_app: {
      title: "System Alert: " + (data.issue ?? "Fault"),
      body: `Your site ${data.siteName ?? ""} requires attention.`,
    },
    push: {
      title: "System Alert ⚠️",
      body: `Your site ${data.siteName ?? ""} reported a fault: ${data.issue ?? ""}`,
    },
    sms: {
      body: `T&S Alert: Site ${data.siteName ?? ""} issue - ${data.issue ?? ""}`,
    },
  }),
  installment_due_reminder: (data) => ({
    sms: {
      body: `T&S Reminder: Installment of ₦${data.amount ?? "0"} is due on ${data.dueDate ?? "soon"}.`,
    },
    email: {
      subject: "Installment Due Reminder",
      component: <DefaultEmail title="Installment Due" body={`Your installment of ₦${data.amount ?? "0"} is due on ${data.dueDate ?? "soon"}.`} />,
    },
  }),
  withdrawal_confirmation: (data) => ({
    push: {
      title: "Withdrawal Sent",
      body: `₦${data.amount ?? "0"} is on its way to your bank account.`,
      url: `/host/earnings`,
    },
    sms: {
      body: `T&S: Withdrawal of ₦${data.amount ?? "0"} initiated.`,
    },
    email: {
      subject: "Withdrawal Confirmation",
      component: <DefaultEmail title="Withdrawal Sent" body={`We have processed your withdrawal of ₦${data.amount ?? "0"}.`} />,
    },
  }),
  dispute_raised_against: (data) => ({
    push: {
      title: "Dispute Raised",
      body: `A dispute was raised on your site. Please check the support portal.`,
    },
    email: {
      subject: "Dispute Raised",
      component: <DefaultEmail title="Dispute Raised" body={`A neighbor raised a dispute. Please review it in the app.`} />,
    },
  }),
  dispute_resolution: (data) => ({
    push: {
      title: "Dispute Resolved",
      body: `Dispute #${data.disputeId ?? ""} has been resolved.`,
    },
    email: {
      subject: "Dispute Resolved",
      component: <DefaultEmail title="Dispute Resolved" body={`Your dispute has been closed. Conclusion: ${data.resolution ?? ""}`} />,
    },
  }),

  // --- NEIGHBOR ---
  welcome_connection: (data) => ({
    whatsapp: {
      templateName: "welcome_neighbor",
      parameters: [data.neighborName ?? "Neighbor"],
    },
  }),
  topup_confirmation: (data) => ({
    whatsapp: {
      templateName: "topup_confirmation",
      parameters: [String(data.amount ?? "0"), String(data.balance ?? "0")],
    },
  }),
  low_balance_warning: (data) => ({
    whatsapp: {
      templateName: "low_balance",
      parameters: [String(data.balance ?? "0")],
    },
    sms: {
      body: `T&S Warning: Low balance (₦${data.balance ?? "0"}). Please top up soon to avoid disconnection.`,
    },
  }),
  disconnect_notification: (data) => ({
    whatsapp: {
      templateName: "disconnected",
      parameters: [],
    },
    sms: {
      body: `T&S Alert: Your power has been disconnected due to zero balance. Top up to reconnect.`,
    },
  }),
  reconnect_confirmation: (data) => ({
    whatsapp: {
      templateName: "reconnected",
      parameters: [],
    },
  }),
  daily_usage_summary: (data) => ({
    whatsapp: {
      templateName: "daily_usage",
      parameters: [String(data.kwh ?? "0"), String(data.cost ?? "0")],
    },
  }),
  price_change_by_host: (data) => ({
    whatsapp: {
      templateName: "price_change",
      parameters: [String(data.newPrice ?? "0")],
    },
  }),

  // --- ADMIN ---
  new_lead_submitted: (data) => ({
    in_app: {
      title: "New Lead",
      body: `${data.name ?? "Someone"} submitted an inquiry.`,
      url: `/admin/leads`,
    },
  }),
  high_priority_dispute: (data) => ({
    in_app: {
      title: "High Priority Dispute",
      body: `A critical dispute was opened for site ${data.siteId ?? ""}.`,
      url: `/admin/disputes`,
    },
    email: {
      subject: "URGENT: High Priority Dispute",
      component: <DefaultEmail title="High Priority Dispute" body={`Please investigate dispute for site ${data.siteId ?? ""}.`} />,
    },
  }),
  gateway_offline_prolonged: (data) => ({
    in_app: {
      title: "Gateway Offline",
      body: `Gateway at site ${data.siteId ?? ""} has been offline for >30min.`,
      url: `/admin/sites/${data.siteId ?? ""}`,
    },
    email: {
      subject: "Gateway Offline Alert",
      component: <DefaultEmail title="Gateway Offline" body={`Site ${data.siteId ?? ""} gateway is offline.`} />,
    },
  }),
  installment_overdue: (data) => ({
    in_app: {
      title: "Installment Overdue",
      body: `Host ${data.hostId ?? ""} missed an installment.`,
      url: `/admin/reports/installment-collection`,
    },
  }),
  system_fault_reported: (data) => ({
    in_app: {
      title: "System Fault",
      body: `Fault reported at site ${data.siteId ?? ""}: ${data.fault ?? ""}`,
    },
    email: {
      subject: "System Fault Alert",
      component: <DefaultEmail title="System Fault" body={`Fault at site ${data.siteId ?? ""}: ${data.fault ?? ""}`} />,
    },
    sms: {
      body: `T&S Admin: Critical fault at site ${data.siteId ?? ""}. Check dashboard.`,
    },
  }),
  large_withdrawal_request: (data) => ({
    in_app: {
      title: "Large Withdrawal",
      body: `₦${data.amount ?? "0"} withdrawal requested by ${data.hostId ?? ""}.`,
      url: `/admin/transactions`,
    },
    email: {
      subject: "Large Withdrawal Request",
      component: <DefaultEmail title="Large Withdrawal" body={`Amount: ₦${data.amount ?? "0"}. Please review.`} />,
    },
  }),
  kyc_submission_pending: (data) => ({
    in_app: {
      title: "KYC Pending Review",
      body: `New KYC submitted by ${data.hostId ?? ""}.`,
      url: `/admin/customers`,
    },
  }),
};
