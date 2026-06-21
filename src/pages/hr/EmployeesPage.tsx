import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserCheck, Plus, Loader2, Trash2, Pencil, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import {
  PageHeader, PrimaryButton, Card, LoadingState, EmptyState, Field, inputClass,
  StatusBadge, SearchInput,
} from "@/components/ui/shared";
import { employeeSchema } from "@/lib/validations";
import { createSystemUserAuth, uploadFile } from "@/lib/backend-utils";
import {
  subscribeEmployees, addEmployee, updateEmployee, deleteEmployee, subscribeDepartments,
} from "@/lib/db";
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import type { Employee, Department, EmployeeRole } from "@/types";

type EmployeeFormData = z.infer<typeof employeeSchema> & { departmentId?: string; phone?: string };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [toDelete, setToDelete] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    const unsubs = [
      subscribeEmployees((rows) => { setEmployees(rows); setLoading(false); }),
      subscribeDepartments(setDepartments),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name;

  const filtered = useMemo(
    () => employees.filter((e) =>
      (e.fullName.toLowerCase().includes(search.toLowerCase()) ||
        e.workerId.toLowerCase().includes(search.toLowerCase())) &&
      (!filterDept || e.departmentId === filterDept)
    ),
    [employees, search, filterDept]
  );

  async function onSubmit(data: EmployeeFormData) {
    setSubmitting(true); setError("");
    try {
      await createSystemUserAuth(data.email, data.password);
      await addEmployee({
        fullName: data.fullName, workerId: data.workerId, position: data.position,
        email: data.email, role: data.role, departmentId: data.departmentId || undefined,
        phone: data.phone, status: "Active", joinDate: Timestamp.now(),
      });
      reset();
      setCreateOpen(false);
    } catch (err) {
      setError("Failed to create account. " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function roleTone(role: EmployeeRole) {
    return role === "Executive" ? "black" : role === "HR" ? "red" : "neutral";
  }

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        icon={UserCheck}
        title="Employees"
        subtitle="Staff directory and accounts"
        actions={<PrimaryButton onClick={() => { reset(); setError(""); setCreateOpen(true); }}><Plus size={16} /> New Employee</PrimaryButton>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or Worker ID..." />
        <select className={cn(inputClass, "max-w-[200px]")} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={UserCheck} label="No employees found" /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <Card key={emp.id} className="p-5 hover:shadow-md transition group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-red-100 text-red-800 flex items-center justify-center font-bold">
                    {emp.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-black">{emp.fullName}</p>
                    <p className="text-xs text-neutral-500">{emp.position}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setProfile(emp)} className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500"><Pencil size={14} /></button>
                  <button onClick={() => setToDelete(emp)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-red-800">{emp.workerId}</span>
                <StatusBadge label={emp.role} tone={roleTone(emp.role)} dot={false} />
              </div>
              <p className="text-xs text-neutral-400 mt-2">{deptName(emp.departmentId) ?? "No department"} · {emp.email}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Create employee */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" error={errors.fullName?.message}><input className={inputClass} {...register("fullName")} /></Field>
              <Field label="Worker ID" error={errors.workerId?.message}><input className={inputClass} {...register("workerId")} placeholder="RZ001" /></Field>
              <Field label="Position" error={errors.position?.message}><input className={inputClass} {...register("position")} /></Field>
              <Field label="Phone"><input className={inputClass} {...register("phone")} /></Field>
              <Field label="Email" error={errors.email?.message}><input type="email" className={inputClass} {...register("email")} /></Field>
              <Field label="Password" error={errors.password?.message}><input type="password" className={inputClass} {...register("password")} /></Field>
              <Field label="Role" error={errors.role?.message}>
                <select className={inputClass} {...register("role")}>
                  <option value="">Select role</option>
                  <option value="Executive">Executive</option>
                  <option value="HR">HR</option>
                  <option value="Staff">Staff</option>
                </select>
              </Field>
              <Field label="Department">
                <select className={inputClass} {...register("departmentId")}>
                  <option value="">None</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="text-red-700 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancel</button>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
              </PrimaryButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {profile && <EmployeeProfile employee={profile} departments={departments} onClose={() => setProfile(null)} />}

      <DeleteConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete) await deleteEmployee(toDelete.id); setToDelete(null); }}
        title="Delete Employee"
        description={`Remove "${toDelete?.fullName}" from the directory? (Their auth login is not deleted.)`}
      />
    </div>
  );
}

function EmployeeProfile({ employee, departments, onClose }: { employee: Employee; departments: Department[]; onClose: () => void }) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [position, setPosition] = useState(employee.position);
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [departmentId, setDepartmentId] = useState(employee.departmentId ?? "");
  const [role, setRole] = useState<EmployeeRole>(employee.role);
  const [uploading, setUploading] = useState(false);

  async function save() {
    await updateEmployee(employee.id, { fullName, position, phone, departmentId: departmentId || undefined, role });
    onClose();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadFile(file, `employees/${employee.id}`);
      const docs = [...(employee.documents ?? []), { name: file.name, url, uploadedAt: Timestamp.now() }];
      await updateEmployee(employee.id, { documents: docs });
      employee.documents = docs;
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Employee Profile</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name"><input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Position"><input className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
            <Field label="Phone"><input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Role">
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)}>
                <option value="Executive">Executive</option><option value="HR">HR</option><option value="Staff">Staff</option>
              </select>
            </Field>
            <Field label="Department">
              <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-600 mb-2">Documents</p>
            <div className="space-y-1.5 mb-2">
              {(employee.documents ?? []).map((doc, i) => (
                <a key={i} href={doc.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm bg-neutral-50 rounded-lg px-3 py-2 hover:bg-neutral-100">
                  <span className="text-black truncate">{doc.name}</span>
                  <X size={14} className="text-neutral-400 rotate-45" />
                </a>
              ))}
              {(employee.documents ?? []).length === 0 && <p className="text-xs text-neutral-400">No documents uploaded.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-red-800 cursor-pointer hover:underline">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Upload document
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg">Close</button>
            <PrimaryButton onClick={save}>Save</PrimaryButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
