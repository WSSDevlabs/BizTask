import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus,
} from "@/components/ui/shared";
import {
  subscribeLeaveRequests, addLeaveRequest, updateLeaveRequest, subscribeEmployees,
  subscribeLeaveBalances,
} from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { formatDate, toJsDate, dateStringToTimestamp, daysBetween } from "@/lib/utils";
import type { LeaveRequest, LeaveType, LeaveStatus, Employee, LeaveBalance } from "@/types";

const TYPES: LeaveType[] = ["Annual", "MC", "Unpaid", "Emergency"];

export default function LeavePage() {
  const { role } = useAuth();
  const isExec = role === "Executive" || role === "HR";

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaveStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("Annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeLeaveRequests((rows) => { setRequests(rows); setLoading(false); }),
      subscribeEmployees(setEmployees),
      subscribeLeaveBalances(setBalances),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const filtered = useMemo(
    () => requests.filter((r) => !filter || r.status === filter),
    [requests, filter]
  );

  function balanceFor(empId: string): LeaveBalance | undefined {
    return balances.find((b) => b.employeeId === empId && b.year === new Date().getFullYear());
  }

  async function handleSave() {
    if (!employeeId || !startDate || !endDate || !reason.trim()) { setError("All fields are required"); return; }
    const start = new Date(startDate), end = new Date(endDate);
    if (end < start) { setError("End date must be after start date"); return; }
    const emp = employees.find((e) => e.id === employeeId);
    try {
      await addLeaveRequest({
        employeeId, employeeName: emp?.fullName ?? "Employee", type,
        startDate: dateStringToTimestamp(startDate)!, endDate: dateStringToTimestamp(endDate)!,
        days: daysBetween(start, end), reason, status: "Pending",
      });
      setModalOpen(false);
      setEmployeeId(""); setType("Annual"); setStartDate(""); setEndDate(""); setReason(""); setError("");
    } catch (err) {
      setError("Failed to submit. " + (err as Error).message);
    }
  }

  async function review(r: LeaveRequest, status: LeaveStatus) {
    await updateLeaveRequest(r.id, { status });
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={CalendarDays}
        title="Leave Management"
        subtitle="Requests, approvals and balances"
        actions={<PrimaryButton onClick={() => { setError(""); setModalOpen(true); }}><Plus size={16} /> Request Leave</PrimaryButton>}
      />

      {/* Balances */}
      {employees.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {employees.slice(0, 6).map((emp) => {
            const bal = balanceFor(emp.id);
            const annualTotal = bal?.annualTotal ?? 14;
            const annualUsed = bal?.annualUsed ?? requests.filter((r) => r.employeeId === emp.id && r.type === "Annual" && r.status === "Approved").reduce((s, r) => s + r.days, 0);
            return (
              <Card key={emp.id} className="p-4">
                <p className="text-sm font-semibold text-black">{emp.fullName}</p>
                <p className="text-xs text-neutral-500 mt-1">Annual leave: {annualUsed}/{annualTotal} days used</p>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-red-800 rounded-full" style={{ width: `${Math.min(100, (annualUsed / annualTotal) * 100)}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["", "Pending", "Approved", "Rejected"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === s ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={CalendarDays} label="No leave requests" />
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
              <tr>
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 font-medium">Days</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isExec && <th className="px-5 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-black">{r.employeeName}</td>
                  <td className="px-5 py-3 text-neutral-600">{r.type}</td>
                  <td className="px-5 py-3 text-neutral-600">{formatDate(toJsDate(r.startDate)!)} – {formatDate(toJsDate(r.endDate)!)}</td>
                  <td className="px-5 py-3 text-neutral-600">{r.days}</td>
                  <td className="px-5 py-3 text-neutral-600 max-w-[200px] truncate">{r.reason}</td>
                  <td className="px-5 py-3"><StatusBadge label={r.status} tone={toneForStatus(r.status)} /></td>
                  {isExec && (
                    <td className="px-5 py-3 text-right">
                      {r.status === "Pending" ? (
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => review(r, "Approved")} className="p-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100"><Check size={15} /></button>
                          <button onClick={() => review(r, "Rejected")} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"><X size={15} /></button>
                        </div>
                      ) : <span className="text-xs text-neutral-400">Reviewed</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Employee">
              <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as LeaveType)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="End Date"><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
            </div>
            <Field label="Reason"><textarea className={inputClass} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={handleSave}>Submit</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
