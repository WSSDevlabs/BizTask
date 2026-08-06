import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Check, X, Clock, LogIn, LogOut } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, toneForStatus,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeLeaveRequests, addLeaveRequest, updateLeaveRequest, subscribeEmployees,
  subscribeLeaveBalances, subscribeAttendance, addAttendanceRecord, updateAttendanceRecord,
} from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDate, toJsDate, dateStringToTimestamp, daysBetween } from "@/lib/utils";
import type {
  LeaveRequest, LeaveType, LeaveStatus, Employee, LeaveBalance, AttendanceRecord, AttendanceStatus,
} from "@/types";

const TYPES: LeaveType[] = ["Annual", "MC", "Unpaid", "Emergency"];

type Tab = "leave" | "attendance";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function timeStr(d?: Date | null) {
  return d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";
}

// Late if clock-in after 09:15
function statusFromClockIn(d: Date): AttendanceStatus {
  return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 15) ? "Late" : "Present";
}

export default function LeavePage() {
  const { role } = useAuth();
  const isExec = role === "Executive" || role === "HR";

  const [tab, setTab] = useState<Tab>("leave");

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empLoaded, setEmpLoaded] = useState(false);

  // ── Leave ──────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [lvLoaded, setLvLoaded] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [lvFilter, setLvFilter] = useState<LeaveStatus | "">("");
  const [lvModalOpen, setLvModalOpen] = useState(false);

  const [lvEmployeeId, setLvEmployeeId] = useState("");
  const [lvType, setLvType] = useState<LeaveType>("Annual");
  const [lvStartDate, setLvStartDate] = useState("");
  const [lvEndDate, setLvEndDate] = useState("");
  const [lvReason, setLvReason] = useState("");
  const [lvError, setLvError] = useState("");

  useEffect(() => {
    const unsubs = [
      subscribeEmployees((rows) => { setEmployees(rows); setEmpLoaded(true); }),
      subscribeLeaveRequests((rows) => { setRequests(rows); setLvLoaded(true); }),
      subscribeLeaveBalances(setBalances),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const lvFiltered = useMemo(
    () => requests.filter((r) => !lvFilter || r.status === lvFilter),
    [requests, lvFilter]
  );

  function balanceFor(empId: string): LeaveBalance | undefined {
    return balances.find((b) => b.employeeId === empId && b.year === new Date().getFullYear());
  }

  async function lvHandleSave() {
    if (!lvEmployeeId || !lvStartDate || !lvEndDate || !lvReason.trim()) { setLvError("All fields are required"); return; }
    const start = new Date(lvStartDate), end = new Date(lvEndDate);
    if (end < start) { setLvError("End date must be after start date"); return; }
    const emp = employees.find((e) => e.id === lvEmployeeId);
    try {
      await addLeaveRequest({
        employeeId: lvEmployeeId, employeeName: emp?.fullName ?? "Employee", type: lvType,
        startDate: dateStringToTimestamp(lvStartDate)!, endDate: dateStringToTimestamp(lvEndDate)!,
        days: daysBetween(start, end), reason: lvReason, status: "Pending",
      });
      setLvModalOpen(false);
      setLvEmployeeId(""); setLvType("Annual"); setLvStartDate(""); setLvEndDate(""); setLvReason(""); setLvError("");
    } catch (err) {
      setLvError("Failed to submit. " + (err as Error).message);
    }
  }

  async function lvReview(r: LeaveRequest, status: LeaveStatus) {
    await updateLeaveRequest(r.id, { status });
  }

  // ── Attendance ─────────────────────────────────────────────────────────────
  const [attRecords, setAttRecords] = useState<AttendanceRecord[]>([]);
  const [attLoaded, setAttLoaded] = useState(false);
  const [attSelectedEmp, setAttSelectedEmp] = useState("");
  const [attRangeDays, setAttRangeDays] = useState(7);
  const [attError, setAttError] = useState("");

  useEffect(() => subscribeAttendance((rows) => { setAttRecords(rows); setAttLoaded(true); }), []);

  useEffect(() => {
    if (employees[0] && !attSelectedEmp) setAttSelectedEmp(employees[0].id);
  }, [employees, attSelectedEmp]);

  const today = todayStr();
  const attTodayRecords = useMemo(() => attRecords.filter((r) => r.date === today), [attRecords, today]);

  function myTodayRecord(): AttendanceRecord | undefined {
    return attRecords.find((r) => r.date === today && r.employeeId === attSelectedEmp);
  }

  async function clockIn() {
    if (!attSelectedEmp) return;
    setAttError("");
    const emp = employees.find((e) => e.id === attSelectedEmp);
    const now = new Date();
    try {
      await addAttendanceRecord({
        employeeId: attSelectedEmp, employeeName: emp?.fullName ?? "Employee", date: today,
        clockIn: Timestamp.now(), status: statusFromClockIn(now),
      });
    } catch (err) {
      setAttError("Clock in failed. " + (err as Error).message);
    }
  }

  async function clockOut() {
    const rec = myTodayRecord();
    if (!rec) return;
    setAttError("");
    try {
      await updateAttendanceRecord(rec.id, { clockOut: Timestamp.now() });
    } catch (err) {
      setAttError("Clock out failed. " + (err as Error).message);
    }
  }

  function workingHours(r: AttendanceRecord): string {
    const inTime = toJsDate(r.clockIn);
    if (!inTime) return "—";
    const outTime = toJsDate(r.clockOut) ?? new Date();
    const ms = outTime.getTime() - inTime.getTime();
    if (ms <= 0) return "—";
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.round((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m${r.clockOut ? "" : " (ongoing)"}`;
  }

  const historyDates = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < attRangeDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [attRangeDays]);

  const loading = !(empLoaded && lvLoaded && attLoaded);
  usePageHeader({ actions: tab === "leave" ? <PrimaryButton onClick={() => { setLvError(""); setLvModalOpen(true); }}><Plus size={16} /> Request Leave</PrimaryButton> : undefined });

  if (loading) return <LoadingState />;

  const myRec = myTodayRecord();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="inline-flex items-center gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
        <button onClick={() => setTab("leave")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "leave" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Leave</button>
        <button onClick={() => setTab("attendance")} className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition", tab === "attendance" ? "bg-white text-black shadow-sm" : "text-neutral-500 hover:text-black")}>Attendance</button>
      </div>

      {tab === "leave" && (
        <>
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
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (annualUsed / annualTotal) * 100)}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            {(["", "Pending", "Approved", "Rejected"] as const).map((s) => (
              <button key={s} onClick={() => setLvFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${lvFilter === s ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>
                {s || "All"}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {lvFiltered.length === 0 ? (
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
                  {lvFiltered.map((r) => (
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
                              <button onClick={() => lvReview(r, "Approved")} className="p-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100"><Check size={15} /></button>
                              <button onClick={() => lvReview(r, "Rejected")} className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100"><X size={15} /></button>
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
        </>
      )}

      {tab === "attendance" && (
        <>
          <Card className="p-5 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <select className={cn(inputClass, "max-w-xs")} value={attSelectedEmp} onChange={(e) => setAttSelectedEmp(e.target.value)}>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
              <div className="flex gap-2">
                <PrimaryButton onClick={clockIn} disabled={!!myRec}><LogIn size={16} /> Clock In</PrimaryButton>
                <button onClick={clockOut} disabled={!myRec || !!myRec.clockOut} className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium rounded-lg text-sm transition">
                  <LogOut size={16} /> Clock Out
                </button>
              </div>
              {myRec && (
                <p className="text-sm text-neutral-500">
                  In: {timeStr(toJsDate(myRec.clockIn))} · Out: {timeStr(toJsDate(myRec.clockOut))}
                </p>
              )}
            </div>
            {attError && <p className="text-red-700 text-sm mt-3">{attError}</p>}
          </Card>

          <Card className="overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-neutral-200"><h2 className="font-semibold text-black">Today ({today})</h2></div>
            {attTodayRecords.length === 0 ? (
              <EmptyState icon={Clock} label="No one has clocked in today" />
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                  <tr><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 font-medium">Clock In</th><th className="px-5 py-3 font-medium">Clock Out</th><th className="px-5 py-3 font-medium">Working Hours</th><th className="px-5 py-3 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {attTodayRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 font-medium text-black">{r.employeeName}</td>
                      <td className="px-5 py-3 text-neutral-600">{timeStr(toJsDate(r.clockIn))}</td>
                      <td className="px-5 py-3 text-neutral-600">{timeStr(toJsDate(r.clockOut))}</td>
                      <td className="px-5 py-3 text-neutral-600">{workingHours(r)}</td>
                      <td className="px-5 py-3"><StatusBadge label={r.status} tone={toneForStatus(r.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
              <h2 className="font-semibold text-black">History</h2>
              <select className={cn(inputClass, "max-w-[140px]")} value={attRangeDays} onChange={(e) => setAttRangeDays(Number(e.target.value))}>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
                  <tr>
                    <th className="px-5 py-3 font-medium sticky left-0 bg-neutral-50">Employee</th>
                    {historyDates.map((d) => <th key={d} className="px-3 py-3 font-medium text-center whitespace-nowrap">{d.slice(5)}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 font-medium text-black sticky left-0 bg-white">{emp.fullName}</td>
                      {historyDates.map((d) => {
                        const rec = attRecords.find((r) => r.employeeId === emp.id && r.date === d);
                        const tone = rec ? (rec.status === "Late" ? "bg-amber-400" : rec.status === "Absent" ? "bg-red-400" : "bg-green-500") : "bg-neutral-200";
                        return <td key={d} className="px-3 py-3 text-center"><span className={cn("inline-block w-3 h-3 rounded-full", tone)} title={rec?.status ?? "No record"} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 flex gap-4 text-xs text-neutral-500 border-t border-neutral-100">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Late</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-neutral-200" /> No record</span>
            </div>
          </Card>
        </>
      )}

      <Dialog open={lvModalOpen} onOpenChange={setLvModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Field label="Employee">
              <select className={inputClass} value={lvEmployeeId} onChange={(e) => setLvEmployeeId(e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputClass} value={lvType} onChange={(e) => setLvType(e.target.value as LeaveType)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date"><input type="date" className={inputClass} value={lvStartDate} onChange={(e) => setLvStartDate(e.target.value)} /></Field>
              <Field label="End Date"><input type="date" className={inputClass} value={lvEndDate} onChange={(e) => setLvEndDate(e.target.value)} /></Field>
            </div>
            <Field label="Reason"><textarea className={inputClass} rows={2} value={lvReason} onChange={(e) => setLvReason(e.target.value)} /></Field>
            {lvError && <p className="text-red-700 text-sm">{lvError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setLvModalOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton onClick={lvHandleSave}>Submit</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
