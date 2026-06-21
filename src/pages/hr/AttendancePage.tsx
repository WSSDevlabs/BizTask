import { useEffect, useMemo, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, StatusBadge, toneForStatus, inputClass,
} from "@/components/ui/shared";
import {
  subscribeAttendance, addAttendanceRecord, updateAttendanceRecord, subscribeEmployees,
} from "@/lib/db";
import { Timestamp } from "firebase/firestore";
import { cn, toJsDate } from "@/lib/utils";
import type { AttendanceRecord, Employee, AttendanceStatus } from "@/types";

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

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [rangeDays, setRangeDays] = useState(7);

  useEffect(() => {
    const unsubs = [
      subscribeAttendance((rows) => { setRecords(rows); setLoading(false); }),
      subscribeEmployees((rows) => { setEmployees(rows); if (rows[0] && !selectedEmp) setSelectedEmp(rows[0].id); }),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = todayStr();
  const todayRecords = useMemo(() => records.filter((r) => r.date === today), [records, today]);

  function myTodayRecord(): AttendanceRecord | undefined {
    return records.find((r) => r.date === today && r.employeeId === selectedEmp);
  }

  async function clockIn() {
    if (!selectedEmp) return;
    const emp = employees.find((e) => e.id === selectedEmp);
    const now = new Date();
    await addAttendanceRecord({
      employeeId: selectedEmp, employeeName: emp?.fullName ?? "Employee", date: today,
      clockIn: Timestamp.now(), status: statusFromClockIn(now),
    });
  }

  async function clockOut() {
    const rec = myTodayRecord();
    if (rec) await updateAttendanceRecord(rec.id, { clockOut: Timestamp.now() });
  }

  const historyDates = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < rangeDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [rangeDays]);

  if (loading) return <LoadingState />;

  const myRec = myTodayRecord();

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader icon={Clock} title="Attendance" subtitle="Clock in / out and daily tracking" />

      {/* Clock in/out */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <select className={cn(inputClass, "max-w-xs")} value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
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
      </Card>

      {/* Today */}
      <Card className="overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-neutral-200"><h2 className="font-semibold text-black">Today ({today})</h2></div>
        {todayRecords.length === 0 ? (
          <EmptyState icon={Clock} label="No one has clocked in today" />
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 text-neutral-500 uppercase text-xs border-b border-neutral-200">
              <tr><th className="px-5 py-3 font-medium">Employee</th><th className="px-5 py-3 font-medium">Clock In</th><th className="px-5 py-3 font-medium">Clock Out</th><th className="px-5 py-3 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {todayRecords.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-black">{r.employeeName}</td>
                  <td className="px-5 py-3 text-neutral-600">{timeStr(toJsDate(r.clockIn))}</td>
                  <td className="px-5 py-3 text-neutral-600">{timeStr(toJsDate(r.clockOut))}</td>
                  <td className="px-5 py-3"><StatusBadge label={r.status} tone={toneForStatus(r.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* History grid */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="font-semibold text-black">History</h2>
          <select className={cn(inputClass, "max-w-[140px]")} value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
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
                    const rec = records.find((r) => r.employeeId === emp.id && r.date === d);
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
    </div>
  );
}
