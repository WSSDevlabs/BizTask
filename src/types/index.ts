import type { Timestamp } from 'firebase/firestore';

// A firestore date can be a JS Date (after conversion) or a Timestamp (raw read)
export type FireDate = Date | Timestamp;

// ── CUSTOMERS ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  businessRegNumber?: string;
  createdAt: FireDate;
}

// ── ORDERS (legacy sales orders) ─────────────────────────────────────────────

export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: 'Draft' | 'Quoted' | 'Partially Paid' | 'Paid' | 'Cancelled';
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingCost?: number;
  grandTotal: number;
  deposit?: number;
  dateIssued: FireDate;
  datePaid?: FireDate;
}

// ── EXPENSES ─────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  receiptImageUrl?: string;
  vendor?: string;
  paymentMethod?: string;
  date: FireDate;
}

export interface DashboardStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

// ── EMPLOYEES ────────────────────────────────────────────────────────────────

export type EmployeeRole = 'Executive' | 'HR' | 'Staff';

export interface EmployeeDocument {
  name: string;
  url: string;
  uploadedAt: FireDate;
}

export interface Employee {
  id: string;
  fullName: string;
  workerId: string;
  position: string;
  email: string;
  role: EmployeeRole;
  departmentId?: string;
  phone?: string;
  joinDate?: FireDate;
  status?: 'Active' | 'Inactive';
  documents?: EmployeeDocument[];
  photoUrl?: string;
  createdAt: FireDate;
}

// ── DEPARTMENTS ──────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  description?: string;
  color: string; // tailwind-friendly hex used as the tag colour
  createdAt: FireDate;
}

// ── PROJECTS ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'Planning' | 'Active' | 'At Risk' | 'On Hold' | 'Completed' | 'Cancelled';
export type ProjectMemberRole = 'Owner' | 'Editor' | 'Viewer';

export interface ProjectMember {
  employeeId: string;
  role: ProjectMemberRole;
}

export interface ProjectLink {
  label: string;
  url: string;
}

export type MilestoneStatus = 'Planned' | 'In Progress' | 'Completed';

export interface ProjectMilestone {
  id: string;
  title: string;
  date?: FireDate;
  status: MilestoneStatus;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  departmentId?: string;
  status: ProjectStatus;
  startDate?: FireDate;
  dueDate?: FireDate;
  budget?: number;
  team?: ProjectMember[];
  links?: ProjectLink[];
  milestones?: ProjectMilestone[];
  notes?: string; // shared notepad, editable by anyone with project access
  createdAt: FireDate;
}

// ── TASKS ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'Review' | 'Done';
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  departmentId?: string;
  projectId?: string;
  assigneeId?: string;
  dueDate?: FireDate;
  dependsOn?: string[]; // task IDs this task is blocked by
  parentTaskId?: string; // set when this task is a subtask of a major task
  createdAt: FireDate;
  updatedAt?: FireDate;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: FireDate;
}

// ── PROJECT ACTIVITY ─────────────────────────────────────────────────────────
// Feeds the Project Progress chart. 'task_deleted' is logged (so the 12h grace
// window can be checked) but is never counted as a plotted activity itself.

export type ProjectActivityType =
  | 'task_created' | 'subtask_created' | 'task_done' | 'subtask_done' | 'task_deleted';

export interface ProjectActivity {
  id: string;
  projectId: string;
  taskId: string;
  type: ProjectActivityType;
  createdAt: FireDate;
}

// ── AUDIT LOG ────────────────────────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  module: string;
  entityId?: string;
  description: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: FireDate;
}

// ── LEAVE / ATTENDANCE ───────────────────────────────────────────────────────

export type LeaveType = 'Annual' | 'MC' | 'Unpaid' | 'Emergency';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  startDate: FireDate;
  endDate: FireDate;
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  createdAt: FireDate;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  annualTotal: number;
  annualUsed: number;
  mcTotal: number;
  mcUsed: number;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD for easy day lookups
  clockIn?: FireDate;
  clockOut?: FireDate;
  status: AttendanceStatus;
  createdAt: FireDate;
}

// ── CRM: LEADS / DEALS / ACTIVITIES / CAMPAIGNS ──────────────────────────────

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type LeadSource =
  | 'Shopee'
  | 'TikTok'
  | 'WhatsApp'
  | 'FB'
  | 'IG'
  | 'Referral'
  | 'Cold Call'
  | 'Other';

export interface Lead {
  id: string;
  company: string;
  contactName: string;
  phone?: string;
  email?: string;
  source: LeadSource;
  stage: LeadStage;
  expectedValue: number;
  notes?: string;
  campaignId?: string;
  createdAt: FireDate;
  updatedAt?: FireDate;
}

export type DealStage =
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Closing'
  | 'Won'
  | 'Lost';

export interface Deal {
  id: string;
  title: string;
  leadId?: string;
  customerId?: string;
  value: number;
  stage: DealStage;
  probability: number; // 0-100
  expectedCloseDate?: FireDate;
  createdAt: FireDate;
  updatedAt?: FireDate;
}

export type ActivityType = 'Call' | 'Meeting' | 'Email' | 'Follow-up' | 'Note';

export interface Activity {
  id: string;
  leadId?: string;
  dealId?: string;
  type: ActivityType;
  summary: string;
  createdBy?: string;
  createdAt: FireDate;
}

export type CampaignChannel =
  | 'Shopee'
  | 'TikTok Shop'
  | 'WhatsApp'
  | 'FB'
  | 'IG'
  | 'Email'
  | 'Google';

export interface CampaignMetric {
  reach: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  budget: number;
  spend: number;
  startDate?: FireDate;
  endDate?: FireDate;
  description?: string;
  metrics: CampaignMetric;
  createdAt: FireDate;
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

export type ProductType = 'Product' | 'Service';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  category?: string;
  type: ProductType;
  createdAt: FireDate;
}

// ── FINANCE: INVOICES / QUOTATIONS / PAYMENTS ────────────────────────────────

export interface InvoiceLine {
  id: string;
  productId?: string; // set when this line came from the product catalog
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // per-line discount amount (RM), deducted before tax
  taxRate: number; // 0 | 6 | 8 (SST %)
  total: number; // qty * unitPrice - discount (pre-tax)
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Cancelled';

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  status: InvoiceStatus;
  issueDate: FireDate;
  dueDate?: FireDate;
  paidDate?: FireDate;
  paymentMethod?: string;
  createdAt: FireDate;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface Quotation {
  id: string;
  number: string;
  customerId: string;
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
  status: QuotationStatus;
  issueDate: FireDate;
  validUntil?: FireDate;
  convertedInvoiceId?: string;
  createdAt: FireDate;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque' | 'E-Wallet';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidDate: FireDate;
  createdAt: FireDate;
}

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;  // e.g. "Software", "Logistics", "Office"
  notes?: string;
  createdAt: FireDate;
}

// ── BILLS (Payables) ──────────────────────────────────────────────────────────
export type BillStatus = 'Pending' | 'Approved' | 'Paid' | 'Overdue';

export interface Bill {
  id: string;
  supplierId: string;
  description: string;
  amount: number;
  category: string;
  status: BillStatus;
  billDate: FireDate;
  dueDate?: FireDate;
  paidDate?: FireDate;
  reference?: string;   // supplier invoice number
  notes?: string;
  createdAt: FireDate;
}

// ── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
export type BillingCycle = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
export type SubscriptionStatus = 'Active' | 'Cancelled';

export interface Subscription {
  id: string;
  name: string;
  vendor?: string;
  amount: number;
  billingCycle: BillingCycle;
  category?: string;
  status: SubscriptionStatus;
  nextRenewal?: FireDate;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: FireDate;
}

// ── MAINTENANCE ──────────────────────────────────────────────────────────────
// Recurring renewals/upkeep owned by a project team — e.g. client domain or
// hosting renewals. Distinct from Subscriptions, which are company overhead.

export type MaintenanceStatus = 'Active' | 'Completed' | 'Cancelled';

export interface MaintenanceItem {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  assigneeId?: string;
  price: number;
  interval: BillingCycle;
  dueDate: FireDate;
  status: MaintenanceStatus;
  createdAt: FireDate;
}

// ── MONTHLY TARGET ─────────────────────────────────────────────────────────────
export interface MonthlyTarget {
  id: string;
  year: number;
  month: number;   // 1-12
  revenueTarget: number;
  expensesBudget: number;
  createdAt: FireDate;
}

// ── COMPANY SETTINGS ──────────────────────────────────────────────────────────
// Singleton document at settings/company. Executive-only to write.

export interface CompanySettings {
  logoUrl?: string;
  updatedAt?: FireDate;
}

// ── ASSETS (multimedia) ──────────────────────────────────────────────────────

export type AssetType = 'image' | 'video' | 'document';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  url: string;
  size?: number;
  tags: string[];
  campaignId?: string;
  projectId?: string;
  createdAt: FireDate;
}

// ── EXTERNAL TOOLS (Project Management) ──────────────────────────────────────

export interface ExternalTool {
  id: string;
  name: string;
  url: string;
  createdAt: FireDate;
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'overdue_task'
  | 'leave_pending'
  | 'payment_overdue'
  | 'deal_won'
  | 'deal_lost'
  | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: FireDate;
}
