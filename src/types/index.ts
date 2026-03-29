// ============================================================
// InvoiceForge - Core Type Definitions
// ============================================================

// --- Time Entry ---
export interface TimeEntry {
  id: string;
  date: string;
  category: string;
  taskName: string;
  taskId?: string;
  ticketKey?: string;       // Jira ticket key e.g. "PROJ-123"
  ticketSummary?: string;   // Jira issue summary/title
  timeSpent: number;
  description: string;
  resource: string;
  role: string;
  source: 'tempo' | 'clockify' | 'manual';
  isRefined: boolean;
}

// --- Role Rate ---
export interface RoleRate {
  id: string;
  role: string;
  label: string;
  rate: number;
  count?: number;
}

// --- Resource-to-Role Mapping ---
export interface ResourceRoleMapping {
  resourceName: string;
  role: string;
  roleLabel?: string; // Display label e.g. "Backend Developer" — role determines rate
}

// --- Client / Company Info ---
export interface ClientInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  logoUrl?: string;
}

export interface PaymentInfo {
  accountHolder: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  accountType?: string;
  notes?: string;
  contactEmail?: string;
  contactPhone?: string;
}

// --- Project ---
export interface Project {
  id: string;
  name: string;
  client: ClientInfo;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  // Per-project source config
  importSource?: 'tempo' | 'clockify' | 'csv';
  clockifyProjectId?: string;
  clockifyProjectName?: string;
  tempoProjectKey?: string;
  tempoProjectName?: string;
  // Per-source resource mappings
  tempoResourceMappings?: ResourceRoleMapping[];
  clockifyResourceMappings?: ResourceRoleMapping[];
  resourceRoleMappings?: ResourceRoleMapping[]; // legacy / combined
  createdAt: string;
  updatedAt: string;
}

// --- Invoice ---
export type InvoiceType = 'sprint' | 'maintenance';

export interface InvoiceConfig {
  id: string;
  projectId?: string;
  invoiceNumber: string;
  date: string;
  reference: string;
  sprintName: string;
  dateRange: string;
  type: InvoiceType;
  summary: string;
  note: string;
  dueDate: string;
  client: ClientInfo;
  company: CompanyInfo;
  payment: PaymentInfo;
  roles: RoleRate[];
  entries: TimeEntry[];
  phasePlan?: PhasePlan;
  status: 'draft' | 'finalized';
  createdAt: string;
  updatedAt: string;
}

// --- Phase Plan ---
export interface PhasePlanRole {
  role: string;
  plannedHours: number;
  actualHours: number;
}

export interface PhasePlan {
  name: string;
  description?: string;
  roles: PhasePlanRole[];
  totalPlannedHours: number;
}

// --- Integration Settings ---
export interface TempoSettings {
  apiToken: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
}

export interface ClockifySettings {
  apiKey: string;
  workspaceId: string;
}

export interface AISettings {
  anthropicApiKey: string;
  model: string;
}

export interface AppSettings {
  tempo: TempoSettings;
  clockify: ClockifySettings;
  ai: AISettings;
  defaultClient: ClientInfo;
  company: CompanyInfo;
  payment: PaymentInfo;
  defaultRoles: RoleRate[];
  defaultCategories: string[];
  resourceRoleMappings: ResourceRoleMapping[];
  logoDataUrl?: string;
}

// --- AI ---
export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  appliedChanges?: TimeEntryChange[];
}

export interface TimeEntryChange {
  entryId: string;
  field: keyof TimeEntry;
  oldValue: string | number | boolean;
  newValue: string | number | boolean;
}

// --- Import ---
export interface ImportResult {
  entries: TimeEntry[];
  source: 'tempo' | 'clockify' | 'csv';
  dateRange: { start: string; end: string };
  totalHours: number;
  errors: string[];
}
