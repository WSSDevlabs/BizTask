import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search, Settings, LogOut, User, Users, Target, Handshake, FolderKanban,
  ListChecks, UserCheck, Package, Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { navGroups, canSeeNavItem, type NavItem } from "@/lib/nav";
import { logoutAdmin } from "@/lib/backend-utils";
import {
  subscribeCustomers, subscribeLeads, subscribeDeals, subscribeProjects,
  subscribeTasks, subscribeEmployees, subscribeProducts, subscribeSuppliers,
} from "@/lib/db";
import { cn, getInitials } from "@/lib/utils";
import { usePageHeaderOverride } from "@/lib/page-header-context";
import type { Customer, Lead, Deal, Project, Task, Employee, Product, Supplier } from "@/types";

interface SearchHit extends NavItem {
  group: string;
}

interface DataHit {
  id: string;
  type: string;
  icon: LucideIcon;
  label: string;
  sublabel: string;
  to: string;
}

export default function TopBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role, isLoading, user, employee } = useAuth();
  const override = usePageHeaderOverride();

  const currentNavItem = useMemo(() => {
    const flat = navGroups.flatMap((g) => g.items);
    return flat.find((i) => i.href === pathname) ?? flat.find((i) => pathname.startsWith(i.href + "/"));
  }, [pathname]);

  const PageIcon = override.icon ?? currentNavItem?.icon;
  const pageTitle = override.title ?? currentNavItem?.label;

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const profileWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo<SearchHit[]>(
    () => navGroups.flatMap((g) =>
      g.items.filter((item) => canSeeNavItem(item, role, isLoading)).map((item) => ({ ...item, group: g.title }))
    ),
    [role, isLoading]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q));
  }, [allItems, query]);

  // Data (record-level) search — only subscribed while the search panel is
  // open, so we're not running a dozen background listeners all the time.
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    if (!searchOpen) return;
    const unsubs = [
      subscribeCustomers(setCustomers),
      subscribeLeads(setLeads),
      subscribeDeals(setDeals),
      subscribeProjects(setProjects),
      subscribeTasks(setTasks),
      subscribeEmployees(setEmployees),
      subscribeProducts(setProducts),
      subscribeSuppliers(setSuppliers),
    ];
    return () => unsubs.forEach((u) => u());
  }, [searchOpen]);

  const dataResults = useMemo<DataHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: DataHit[] = [];

    customers.forEach((c) => {
      if (c.company.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
        hits.push({ id: c.id, type: "Customer", icon: Users, label: c.company, sublabel: c.name, to: "/customers" });
      }
    });
    leads.forEach((l) => {
      if (l.company.toLowerCase().includes(q) || l.contactName.toLowerCase().includes(q)) {
        hits.push({ id: l.id, type: "Lead", icon: Target, label: l.company, sublabel: `${l.contactName} · ${l.stage}`, to: "/crm/leads" });
      }
    });
    deals.forEach((d) => {
      if (d.title.toLowerCase().includes(q)) {
        hits.push({ id: d.id, type: "Deal", icon: Handshake, label: d.title, sublabel: d.stage, to: "/crm/leads" });
      }
    });
    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q)) {
        hits.push({ id: p.id, type: "Project", icon: FolderKanban, label: p.name, sublabel: p.status, to: `/projects/${p.id}` });
      }
    });
    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q)) {
        hits.push({ id: t.id, type: "Task", icon: ListChecks, label: t.title, sublabel: t.status, to: t.projectId ? `/projects/${t.projectId}` : "/tasks" });
      }
    });
    employees.forEach((e) => {
      if (e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)) {
        hits.push({ id: e.id, type: "Employee", icon: UserCheck, label: e.fullName, sublabel: e.position, to: "/hr/employees" });
      }
    });
    products.forEach((p) => {
      if (p.name.toLowerCase().includes(q)) {
        hits.push({ id: p.id, type: "Product", icon: Package, label: p.name, sublabel: p.category ?? "Product", to: "/crm/products" });
      }
    });
    suppliers.forEach((s) => {
      if (s.name.toLowerCase().includes(q)) {
        hits.push({ id: s.id, type: "Supplier", icon: Truck, label: s.name, sublabel: s.category ?? "Supplier", to: "/finance/suppliers" });
      }
    });

    return hits.slice(0, 20);
  }, [query, customers, leads, deals, projects, tasks, employees, products, suppliers]);

  const combinedCount = results.length + dataResults.length;
  useEffect(() => setActiveIndex(0), [results, dataResults]);

  // Global Ctrl/Cmd+K to jump into search from anywhere
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Click-outside to close either popover
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (profileWrapRef.current && !profileWrapRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function goTo(item: SearchHit) {
    navigate(item.href);
    closeSearch();
  }

  function goToData(item: DataHit) {
    navigate(item.to);
    closeSearch();
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setSearchOpen(false); inputRef.current?.blur(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % Math.max(1, combinedCount)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + combinedCount) % Math.max(1, combinedCount)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex < results.length) { const hit = results[activeIndex]; if (hit) goTo(hit); }
      else { const hit = dataResults[activeIndex - results.length]; if (hit) goToData(hit); }
    }
  }

  async function handleLogout() {
    await logoutAdmin();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 bg-white border-b border-neutral-200 flex items-center gap-4 px-4 lg:px-6">
      {/* Page icon + title */}
      {(PageIcon || pageTitle) && (
        <div className="flex items-center gap-2.5 shrink-0 ml-10 lg:ml-0">
          {PageIcon && (
            <div className="bg-gradient-to-br from-neutral-900 to-black text-white p-2 rounded-lg shrink-0">
              <PageIcon size={16} />
            </div>
          )}
          {pageTitle && <h1 className="text-base font-bold text-neutral-900 tracking-tight hidden sm:block whitespace-nowrap">{pageTitle}</h1>}
        </div>
      )}

      {/* Global search */}
      <div ref={searchWrapRef} className={cn("relative flex-1 max-w-md", !(PageIcon || pageTitle) && "ml-10 lg:ml-0")}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search pages, customers, tasks..."
          className="w-full pl-9 pr-14 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-700 focus:bg-white transition-all"
        />
        <kbd className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[10px] font-semibold text-neutral-400 bg-white border border-neutral-200 rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>

        {searchOpen && (
          <div className="absolute top-full left-0 mt-2 w-full sm:w-96 bg-white rounded-xl border border-neutral-200 shadow-lg max-h-96 overflow-y-auto z-50">
            {combinedCount === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">No matches for "{query}"</p>
            ) : (
              <>
                {results.length > 0 && (
                  <div className="py-1.5">
                    {query.trim() && <p className="px-3.5 pt-1 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Pages</p>}
                    {results.map((item, idx) => (
                      <button
                        key={item.href}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors",
                          idx === activeIndex ? "bg-red-50 text-red-900" : "text-neutral-700"
                        )}
                      >
                        <item.icon size={15} className={idx === activeIndex ? "text-red-700" : "text-neutral-400"} />
                        <span className="flex-1 truncate font-medium">{item.label}</span>
                        <span className="text-xs text-neutral-400">{item.group}</span>
                      </button>
                    ))}
                  </div>
                )}
                {dataResults.length > 0 && (
                  <div className="py-1.5 border-t border-neutral-100">
                    <p className="px-3.5 pt-1 pb-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Results</p>
                    {dataResults.map((item, i) => {
                      const idx = results.length + i;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => goToData(item)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors",
                            idx === activeIndex ? "bg-red-50 text-red-900" : "text-neutral-700"
                          )}
                        >
                          <item.icon size={15} className={idx === activeIndex ? "text-red-700" : "text-neutral-400"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.label}</span>
                            <span className="block truncate text-xs text-neutral-400">{item.sublabel}</span>
                          </span>
                          <span className="text-xs text-neutral-400 shrink-0">{item.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Page-specific primary action(s) */}
        {override.actions}

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          aria-label="Settings"
          className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-black transition-colors"
        >
          <Settings size={18} />
        </button>

        {/* Profile */}
        <div ref={profileWrapRef} className="relative">
          <button
            onClick={() => setProfileOpen((o) => !o)}
            aria-label="Account menu"
            className="w-9 h-9 rounded-full bg-red-800 flex items-center justify-center shrink-0 hover:bg-red-900 transition-colors overflow-hidden"
          >
            {employee?.photoUrl ? (
              <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] font-bold text-white">{getInitials(user?.email ?? "?")}</span>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-neutral-200 shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <User size={15} className="text-red-800" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-800 uppercase tracking-wide leading-none">{role ?? "..."}</p>
                  <p className="text-xs text-neutral-500 truncate mt-1">{employee?.fullName || user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-red-700 transition-colors"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
