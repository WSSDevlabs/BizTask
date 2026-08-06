import {
  LayoutDashboard, Users, Wallet, UserCheck,
  FolderKanban, ListChecks, Target, Megaphone, Package,
  BarChart3, CalendarDays, Building2, Activity,
  Bell, Truck, ExternalLink, ArrowLeftRight, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/lib/auth-context";

export type BadgeTone = "red" | "amber";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badgeKey?: "tasks" | "invoices" | "leave" | "bills";
  badgeTone?: BadgeTone;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const ALL_ROLES: Role[] = ["Executive", "HR", "Staff"];

export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
      { href: "/analytics", label: "Business Analytics", icon: Activity, roles: ["Executive"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/project-management", label: "Tools & Sources", icon: ExternalLink, roles: ALL_ROLES },
      { href: "/projects", label: "Project Management", icon: FolderKanban, roles: ALL_ROLES },
      { href: "/tasks",    label: "Tasks",     icon: ListChecks,   roles: ALL_ROLES, badgeKey: "tasks", badgeTone: "red" },
      { href: "/maintenance", label: "Maintenance", icon: Wrench, roles: ALL_ROLES },
    ],
  },
  {
    title: "CRM & Sales",
    items: [
      { href: "/crm/leads",     label: "Leads & Deals", icon: Target, roles: ["Executive", "Staff"] },
      { href: "/crm/campaigns", label: "Campaigns", icon: Megaphone, roles: ["Executive", "Staff"] },
      { href: "/customers",     label: "Customers", icon: Users,     roles: ["Executive", "Staff"] },
      { href: "/crm/products",  label: "Products & Services",  icon: Package,   roles: ["Executive", "Staff"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/finance/transactions", label: "Transaction",  icon: ArrowLeftRight, roles: ["Executive", "Staff"], badgeKey: "invoices", badgeTone: "red" },
      { href: "/finance/expenses",    label: "Expenses",       icon: Wallet,        roles: ["Executive", "Staff"], badgeKey: "bills", badgeTone: "red" },
      { href: "/finance/suppliers",   label: "Suppliers",      icon: Truck,         roles: ["Executive"] },
      { href: "/finance/reports",     label: "Reports",        icon: BarChart3,     roles: ["Executive"] },
    ],
  },
  {
    title: "Human Resources",
    items: [
      { href: "/hr/employees",  label: "Employees",       icon: UserCheck,   roles: ["Executive", "HR"] },
      { href: "/hr/leave",      label: "Leave & Attendance", icon: CalendarDays, roles: ALL_ROLES, badgeKey: "leave", badgeTone: "amber" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/departments",   label: "Departments & Assets", icon: Building2, roles: ALL_ROLES },
      { href: "/notifications", label: "Notifications", icon: Bell,     roles: ALL_ROLES },
    ],
  },
];

export function canSeeNavItem(item: NavItem, role: Role, isLoading: boolean): boolean {
  if (isLoading) return true;
  if (!role) return false;
  if (role === "Executive") return true;
  return item.roles.includes(role);
}
