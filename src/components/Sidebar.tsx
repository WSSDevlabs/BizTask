import { useEffect, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { logoutAdmin } from "@/lib/backend-utils";
import {
  LayoutDashboard, Users, FileText, Wallet, UserCheck, LogOut, Menu, X,
  FolderKanban, ListChecks, Target, Handshake, Megaphone, ReceiptText,
  FileSpreadsheet, BarChart3, CalendarDays, Clock, Image, Building2,
  ScrollText, Bell, Truck, CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/auth-context";
import { cn, toJsDate } from "@/lib/utils";
import {
  subscribeTasks, subscribeInvoices, subscribeLeaveRequests, subscribeBills,
} from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";

type BadgeTone = "red" | "amber";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badgeKey?: "tasks" | "invoices" | "leave" | "bills";
  badgeTone?: BadgeTone;
}

interface BadgeCounts {
  tasks: number;
  invoices: number;
  leave: number;
  bills: number;
}

function useBadgeCounts(): BadgeCounts {
  const [counts, setCounts] = useState<BadgeCounts>({ tasks: 0, invoices: 0, leave: 0, bills: 0 });

  useEffect(() => {
    const now = Date.now();
    const unsubs = [
      subscribeTasks((rows) => {
        const overdue = rows.filter((t) => {
          if (t.status === "Done") return false;
          const d = toJsDate(t.dueDate);
          return !!d && d.getTime() < now;
        }).length;
        setCounts((c) => ({ ...c, tasks: overdue }));
      }),
      subscribeInvoices((rows) => {
        const unpaid = rows.filter((i) => i.status === "Sent" || i.status === "Overdue").length;
        setCounts((c) => ({ ...c, invoices: unpaid }));
      }),
      subscribeLeaveRequests((rows) => {
        const pending = rows.filter((l) => l.status === "Pending").length;
        setCounts((c) => ({ ...c, leave: pending }));
      }),
      subscribeBills((rows) => {
        const pending = rows.filter((b) => b.status === "Pending" || b.status === "Approved" || b.status === "Overdue").length;
        setCounts((c) => ({ ...c, bills: pending }));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  return counts;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ["Executive", "HR", "Staff"];

const groups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/projects", label: "Projects",  icon: FolderKanban, roles: ALL },
      { href: "/tasks",    label: "Tasks",     icon: ListChecks,   roles: ALL, badgeKey: "tasks", badgeTone: "red" },
    ],
  },
  {
    title: "CRM & Sales",
    items: [
      { href: "/crm/leads",     label: "Leads",     icon: Target,    roles: ["Executive", "Staff"] },
      { href: "/crm/deals",     label: "Deals",     icon: Handshake, roles: ["Executive", "Staff"] },
      { href: "/crm/campaigns", label: "Campaigns", icon: Megaphone, roles: ["Executive", "Staff"] },
      { href: "/customers",     label: "Customers", icon: Users,     roles: ["Executive", "Staff"] },
      { href: "/orders",        label: "Orders",    icon: FileText,  roles: ["Executive", "Staff"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/finance/invoices",    label: "Invoices",       icon: ReceiptText,   roles: ["Executive", "Staff"], badgeKey: "invoices", badgeTone: "red" },
      { href: "/finance/quotations",  label: "Quotations",     icon: FileSpreadsheet, roles: ["Executive", "Staff"] },
      { href: "/finance/expenses",    label: "Expenses",       icon: Wallet,        roles: ["Executive", "Staff"] },
      { href: "/finance/suppliers",   label: "Suppliers",      icon: Truck,         roles: ["Executive"] },
      { href: "/finance/bills",       label: "Bills & Payables", icon: CreditCard,  roles: ["Executive", "Staff"], badgeKey: "bills", badgeTone: "red" },
      { href: "/finance/reports",     label: "Reports",        icon: BarChart3,     roles: ["Executive"] },
    ],
  },
  {
    title: "Human Resources",
    items: [
      { href: "/hr/employees",  label: "Employees",       icon: UserCheck,   roles: ["Executive", "HR"] },
      { href: "/hr/leave",      label: "Leave",           icon: CalendarDays, roles: ALL, badgeKey: "leave", badgeTone: "amber" },
      { href: "/hr/attendance", label: "Attendance",      icon: Clock,       roles: ALL },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/assets",        label: "Assets",       icon: Image,     roles: ALL },
      { href: "/departments",   label: "Departments",  icon: Building2, roles: ["Executive", "HR"] },
      { href: "/audit-log",     label: "Audit Log",    icon: ScrollText, roles: ["Executive"] },
      { href: "/notifications", label: "Notifications", icon: Bell,     roles: ALL },
    ],
  },
];

function getInitials(email: string): string {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Sidebar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, isLoading, user } = useAuth();
  const badgeCounts = useBadgeCounts();

  async function handleLogout() {
    await logoutAdmin();
    navigate("/");
  }

  function canSee(item: NavItem): boolean {
    if (isLoading) return true;
    if (!role) return false;
    if (role === "Executive") return true;
    return item.roles.includes(role);
  }

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const SidebarInner = (
    <aside className="h-full w-64 bg-neutral-950 border-r border-white/[0.06] text-white flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-800 flex items-center justify-center shadow-md shadow-red-900/50 shrink-0">
            <span className="text-white font-black text-base leading-none">B</span>
          </div>
          <div>
            <h2 className="text-[15px] font-black tracking-tight text-white leading-none">
              Biz<span className="text-red-500">Task</span>
            </h2>
            <p className="text-[9px] text-white/30 uppercase tracking-[0.2em] mt-0.5 font-medium">Internal ERP</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 mb-1 text-[9px] font-bold text-white/25 uppercase tracking-[0.2em]">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, badgeKey, badgeTone }) => {
                const badge = badgeKey ? badgeCounts[badgeKey] : 0;
                return (
                  <NavLink
                    key={href}
                    to={href}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
                        isActive
                          ? "bg-red-900/30 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-r before:bg-red-500"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/85"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={15}
                          className={cn("shrink-0 transition-colors", isActive ? "text-red-400" : "text-white/40 group-hover:text-white/70")}
                        />
                        <span className="truncate flex-1">{label}</span>
                        {badge > 0 && (
                          <span
                            className={cn(
                              "animate-badge-pop ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1.5",
                              badgeTone === "amber" ? "bg-amber-500" : "bg-red-600"
                            )}
                          >
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-1">
        {!isLoading && user && (
          <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full bg-red-900/60 border border-red-800/60 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-red-300">{getInitials(user.email ?? "")}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none">{role}</p>
              <p className="text-[11px] text-white/45 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-white/40 hover:bg-white/[0.05] hover:text-white/80 transition-all duration-150 group"
        >
          <LogOut size={15} className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors" />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-neutral-950 text-white p-2 rounded-xl shadow-lg border border-white/10"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="sidebar-mobile"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed top-0 left-0 z-40 h-screen w-64 lg:hidden"
          >
            {SidebarInner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-64 shrink-0">
        {SidebarInner}
      </div>
    </>
  );
}
