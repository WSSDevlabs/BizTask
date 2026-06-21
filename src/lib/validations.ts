import { z } from 'zod';

// Customer Schema — validates all client data before writing to Firestore
export const customerSchema = z.object({
  // Name is optional, company is the primary identifier
  name: z.string().optional(),
  // Company is required for B2B invoicing context
  company: z.string().min(1, 'Company name is required'),
  // Email is optional but useful for communication and invoicing
  email: z.string().optional(),
  // Phone is required for direct contact
  phone: z.string().min(1, 'Phone number is required'),
  // Address is optional at validation level but useful for delivery/invoicing
  address: z.string().optional(),
});

// OrderItem Schema — validates individual line items within an order
export const orderItemSchema = z.object({
  // Description identifies what is being sold
  description: z.string().min(1, 'Item description is required'),
  // Quantity must be at least 1 to be a valid line item
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  // Unit price cannot be negative
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  // Total cannot be negative (quantity × unitPrice)
  total: z.number().min(0, 'Total cannot be negative'),
});

// Order Schema — validates the full order document before saving
export const orderSchema = z.object({
  // Links the order to an existing customer document
  customerId: z.string().min(1, 'Customer ID is required'),
  // Status is restricted to a strict enum to prevent invalid states
  status: z.enum(['Draft', 'Quoted', 'Paid', 'Cancelled']),
  // An order must contain at least one line item
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  // Financial totals cannot be negative
  subtotal: z.number().min(0, 'Subtotal cannot be negative'),
  discount: z.number().min(0, 'Discount cannot be negative'),
  grandTotal: z.number().min(0, 'Grand total cannot be negative'),
});

// Expense Schema — validates business expenses before recording
export const expenseSchema = z.object({
  // Description explains what the expense was for
  description: z.string().min(1, 'Expense description is required'),
  // Amount must be a positive number (no zero-value expenses)
  amount: z.number().positive('Expense amount must be positive'),
  // Category groups expenses for reporting (e.g., "Supplies", "Transport")
  category: z.string().min(1, 'Expense category is required'),
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
