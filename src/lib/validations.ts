import { z } from 'zod';

// Customer Schema — validates all client data before writing to Firestore
export const customerSchema = z.object({
  // Name is optional, company is the primary identifier
  name: z.string().optional(),
  // Company is required for B2B invoicing context
  company: z.string().min(1, 'Company name is required'),
  // Client email is required — primary contact channel for invoicing/comms
  email: z.string().min(1, 'Client email is required').email('A valid email address is required'),
  // Phone is required for direct contact
  phone: z.string().min(1, 'Phone number is required'),
  // Address is optional at validation level but useful for delivery/invoicing
  address: z.string().optional(),
  // Business Registration Number (SSM) — optional, not every customer has one on file
  businessRegNumber: z.string().optional(),
});

// Employee Schema — validates HR staff data before creating accounts
export const employeeSchema = z.object({
  // Full name is required for identification
  fullName: z.string().min(1, 'Full name is required'),
  // Worker ID is a unique company identifier
  workerId: z.string().min(1, 'Worker ID is required'),
  // Position/title within the company
  position: z.string().min(1, 'Position is required'),
  // Email must be valid for Firebase Auth account creation
  email: z.string().email('A valid email address is required'),
  // Password must be at least 6 characters (Firebase Auth minimum)
  password: z.string().min(6, 'Password must be at least 6 characters'),
  // Role restricts access level within the dashboard
  role: z.enum(['Executive', 'HR', 'Staff']),
  // Phone and department are optional — must still be declared here or
  // zodResolver silently strips them from the submitted form data.
  phone: z.string().optional(),
  departmentId: z.string().optional(),
});

// ── DEPARTMENT ───────────────────────────────────────────────────────────────
export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
  color: z.string().min(1, 'Pick a colour'),
});

// ── PROJECT ──────────────────────────────────────────────────────────────────
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
});

// ── TASK ─────────────────────────────────────────────────────────────────────
export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: z.enum(['Backlog', 'To Do', 'In Progress', 'Review', 'Done']),
  priority: z.enum(['Critical', 'High', 'Medium', 'Low']),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
});

// ── LEAVE REQUEST ────────────────────────────────────────────────────────────
export const leaveSchema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  type: z.enum(['Annual', 'MC', 'Unpaid', 'Emergency']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required'),
});

// ── LEAD ─────────────────────────────────────────────────────────────────────
export const leadSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  source: z.enum(['Shopee', 'TikTok', 'WhatsApp', 'FB', 'IG', 'Referral', 'Cold Call', 'Other']),
  stage: z.enum(['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']),
  expectedValue: z.coerce.number().min(0, 'Value cannot be negative'),
  notes: z.string().optional(),
  campaignId: z.string().optional(),
});

// ── DEAL ─────────────────────────────────────────────────────────────────────
export const dealSchema = z.object({
  title: z.string().min(1, 'Deal title is required'),
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  value: z.coerce.number().min(0, 'Value cannot be negative'),
  stage: z.enum(['Qualification', 'Proposal', 'Negotiation', 'Closing', 'Won', 'Lost']),
  probability: z.coerce.number().min(0).max(100),
  expectedCloseDate: z.string().optional(),
});

// ── CAMPAIGN ─────────────────────────────────────────────────────────────────
export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  channel: z.enum(['Shopee', 'TikTok Shop', 'WhatsApp', 'FB', 'IG', 'Email', 'Google']),
  budget: z.coerce.number().min(0, 'Budget cannot be negative'),
  spend: z.coerce.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

// ── INVOICE / QUOTATION ──────────────────────────────────────────────────────
export const invoiceLineSchema = z.object({
  description: z.string().min(1, 'Description required'),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0),
  total: z.number().min(0),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  discount: z.coerce.number().min(0).optional(),
});

// ── ASSET ────────────────────────────────────────────────────────────────────
export const assetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tags: z.string().optional(),
  campaignId: z.string().optional(),
  projectId: z.string().optional(),
});
