import { useEffect, useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import {
  PageHeader, Card, LoadingState, EmptyState, StatusBadge, inputClass, SearchInput,
} from "@/components/ui/shared";
import { getAuditLogs } from "@/lib/db";
import { cn, formatDate, toJsDate } from "@/lib/utils";
import type { AuditLog, AuditAction } from "@/types";

const actionTone: Record<AuditAction, "green" | "yellow" | "red"> = {
  create: "green", update: "yellow", delete: "red",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterModule, setFilterModule] = useState("");

  useEffect(() => {
    const unsub = getAuditLogs((rows) => { setLogs(rows); setLoading(false); });
    return unsub;
  }, []);

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.module))).sort(), [logs]);

  const filtered = useMemo(
    () => logs.filter((l) =>
      (l.description.toLowerCase().includes(search.toLowerCase()) || l.userEmail.toLowerCase().includes(search.toLowerCase())) &&
      (!filterAction || l.action === filterAction) &&
      (!filterModule || l.module === filterModule)
    ),
    [logs, search, filterAction, filterModule]
  );

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader icon={ScrollText} title="Audit Log" subtitle="Immutable record of all system actions" />

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search actions or users..." />
        <select className={cn(inputClass, "max-w-[160px]")} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select className={cn(inputClass, "max-w-[180px]")} value={filterModule} onChange={(e) => setFilterModule(e.target.value)}>
          <option value="">All Modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={ScrollText} label="No audit entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Module</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 text-neutral-500 whitespace-nowrap">{l.createdAt ? formatDate(toJsDate(l.createdAt)!) : "—"}</td>
                    <td className="px-5 py-3 text-neutral-600">{l.userEmail}</td>
                    <td className="px-5 py-3"><StatusBadge label={l.action} tone={actionTone[l.action]} /></td>
                    <td className="px-5 py-3 text-neutral-600">{l.module}</td>
                    <td className="px-5 py-3 text-black">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
