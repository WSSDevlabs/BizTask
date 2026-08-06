import { useEffect, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { logoutAdmin } from "@/lib/backend-utils";
import { LogOut, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn, toJsDate, getInitials } from "@/lib/utils";
import {
  subscribeTasks, subscribeInvoices, subscribeLeaveRequests, subscribeBills, subscribeCompanySettings,
} from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";
import { navGroups, canSeeNavItem } from "@/lib/nav";

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

export default function Sidebar() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { role, isLoading, user, employee } = useAuth();
  const badgeCounts = useBadgeCounts();
  const [companyLogo, setCompanyLogo] = useState("");

  useEffect(() => subscribeCompanySettings((data) => setCompanyLogo(data.logoUrl ?? "")), []);

  async function handleLogout() {
    await logoutAdmin();
    navigate("/");
  }

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => canSeeNavItem(item, role, isLoading)) }))
    .filter((g) => g.items.length > 0);

  function renderSidebar(isCollapsed: boolean, showCollapseToggle: boolean) {
    return (
      <aside className={cn("h-full bg-neutral-950 border-r border-white/[0.06] text-white flex flex-col transition-[width] duration-200", isCollapsed ? "w-[72px]" : "w-64")}>
        {/* Logo */}
        <div className={cn("py-5 border-b border-white/[0.06]", isCollapsed ? "px-3" : "px-5")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            <div className="flex items-center gap-2.5">
              {companyLogo ? (
                <img src={companyLogo} alt="Company logo" className="w-11 h-11 rounded-xl object-cover shadow-md shadow-red-900/50 shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-red-800 flex items-center justify-center shadow-md shadow-red-900/50 shrink-0">
                  <span className="text-white font-black text-lg leading-none">B</span>
                </div>
              )}
            </div>
            {showCollapseToggle && !isCollapsed && (
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label="Collapse sidebar"
                className="p-1 text-white/40 hover:text-white/80 transition-colors"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>
          {showCollapseToggle && isCollapsed && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Expand sidebar"
              className="mt-3 w-full flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              {!isCollapsed && (
                <p className="px-2.5 mb-1 text-[9px] font-bold text-white/25 uppercase tracking-[0.2em]">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, badgeKey, badgeTone }) => {
                  const badge = badgeKey ? badgeCounts[badgeKey] : 0;
                  return (
                    <NavLink
                      key={href}
                      to={href}
                      title={isCollapsed ? label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-150 group",
                          isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                          isActive
                            ? "bg-red-900/30 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:rounded-r before:bg-red-500"
                            : "text-white/50 hover:bg-white/[0.05] hover:text-white/85"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="relative shrink-0">
                            <Icon
                              size={15}
                              className={cn("transition-colors", isActive ? "text-red-400" : "text-white/40 group-hover:text-white/70")}
                            />
                            {isCollapsed && badge > 0 && (
                              <span className={cn("absolute -top-1 -right-1.5 w-2 h-2 rounded-full", badgeTone === "amber" ? "bg-amber-500" : "bg-red-600")} />
                            )}
                          </span>
                          {!isCollapsed && <span className="truncate flex-1">{label}</span>}
                          {!isCollapsed && badge > 0 && (
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
        <div className={cn("py-3 border-t border-white/[0.06] space-y-1", isCollapsed ? "px-2" : "px-3")}>
          {!isLoading && user && (
            <div className={cn("flex items-center gap-3 py-2.5 rounded-lg mb-1", isCollapsed ? "justify-center px-0" : "px-2.5")}>
              <div className="w-7 h-7 rounded-full bg-red-900/60 border border-red-800/60 flex items-center justify-center shrink-0 overflow-hidden">
                {employee?.photoUrl ? (
                  <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-red-300">{getInitials(user.email ?? "")}</span>
                )}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none">{role}</p>
                  <p className="text-[11px] text-white/45 truncate mt-0.5">{employee?.fullName || user.email}</p>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={cn(
              "flex items-center w-full py-2 rounded-lg text-[13px] font-medium text-white/40 hover:bg-white/[0.05] hover:text-white/80 transition-all duration-150 group",
              isCollapsed ? "justify-center px-0" : "gap-3 px-3"
            )}
          >
            <LogOut size={15} className="shrink-0 text-white/30 group-hover:text-white/60 transition-colors" />
            {!isCollapsed && "Sign Out"}
          </button>
        </div>
      </aside>
    );
  }

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
            {renderSidebar(false, false)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className={cn("hidden lg:flex lg:sticky lg:top-0 lg:h-screen shrink-0 transition-[width] duration-200", collapsed ? "lg:w-[72px]" : "lg:w-64")}>
        {renderSidebar(collapsed, true)}
      </div>
    </>
  );
}
