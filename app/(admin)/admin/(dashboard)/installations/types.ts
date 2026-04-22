export interface InstallationRow {
  id: string;
  stage: string;
  path_type: string | null;
  area: string | null;
  customer_name: string | null;
  scheduled_at: string | null;
  assigned_technician: string | null;
  amount_kobo: number;
  updated_at: string;
}

export const STAGES = [
  { id: "lead_qualified", title: "Lead Qualified" },
  { id: "survey_scheduled", title: "Survey Scheduled" },
  { id: "survey_complete", title: "Survey Complete" },
  { id: "install_scheduled", title: "Install Scheduled" },
  { id: "installing", title: "Installing" },
  { id: "installed", title: "Installed" },
  { id: "active", title: "Active" },
] as const;
