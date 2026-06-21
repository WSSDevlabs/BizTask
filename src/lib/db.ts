import { db, auth } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type QueryConstraint,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  Customer,
  Order,
  Expense,
  DashboardStats,
  Employee,
  Department,
  Project,
  ProjectStatus,
  Task,
  Comment,
  AuditLog,
  AuditAction,
  LeaveRequest,
  LeaveBalance,
  AttendanceRecord,
  Lead,
  Deal,
  Activity,
  Campaign,
  Invoice,
  Quotation,
  Payment,
  Asset,
  Notification,
  Supplier,
  Bill,
  MonthlyTarget,
} from '@/types';

// ── GENERIC HELPERS ──────────────────────────────────────────────────────────

function mapDocs<T>(snapDocs: { id: string; data: () => DocumentData }[]): T[] {
  return snapDocs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function listAll<T>(
  name: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snap = await getDocs(query(collection(db, name), ...constraints));
  return mapDocs<T>(snap.docs);
}

function subscribe<T>(
  name: string,
  cb: (rows: T[]) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  return onSnapshot(query(collection(db, name), ...constraints), (snap) => {
    cb(mapDocs<T>(snap.docs));
  });
}

// ── AUDIT LOG ────────────────────────────────────────────────────────────────

export async function addAuditLog(
  action: AuditAction,
  module: string,
  description: string,
  opts?: {
    entityId?: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId: auth.currentUser?.uid ?? 'system',
      userEmail: auth.currentUser?.email ?? 'system',
      action,
      module,
      description,
      entityId: opts?.entityId ?? null,
      before: opts?.before ?? null,
      after: opts?.after ?? null,
      createdAt: Timestamp.now(),
    });
  } catch (err) {
    // Audit logging must never break the primary write
    console.error('Audit log failed:', err);
  }
}

export function getAuditLogs(cb: (rows: AuditLog[]) => void): Unsubscribe {
  return subscribe<AuditLog>('auditLogs', cb, orderBy('createdAt', 'desc'));
}

// ── CUSTOMERS ────────────────────────────────────────────────────────────────

export async function addCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'customers'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Customers', `Created customer ${data.company}`, { entityId: ref.id, after: data });
  return ref.id;
}

export async function getCustomers(): Promise<Customer[]> {
  return listAll<Customer>('customers', orderBy('name', 'asc'));
}

export function subscribeCustomers(cb: (rows: Customer[]) => void): Unsubscribe {
  return subscribe<Customer>('customers', cb, orderBy('company', 'asc'));
}

export async function updateCustomer(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'customers', id), data);
  await addAuditLog('update', 'Customers', `Updated customer ${data.company ?? id}`, { entityId: id, after: data });
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'customers', id));
  await addAuditLog('delete', 'Customers', `Deleted customer ${id}`, { entityId: id });
}

// ── ORDERS ───────────────────────────────────────────────────────────────────

export async function createOrder(data: Omit<Order, 'id' | 'dateIssued'>): Promise<string> {
  const ref = await addDoc(collection(db, 'orders'), { ...data, dateIssued: Timestamp.now() });
  await addAuditLog('create', 'Orders', `Created order`, { entityId: ref.id });
  return ref.id;
}

export async function getOrders(): Promise<Order[]> {
  return listAll<Order>('orders', orderBy('dateIssued', 'desc'));
}

export async function updateOrder(orderId: string, data: Partial<Omit<Order, 'id' | 'dateIssued'>>): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  if (data.status === 'Paid') payload.datePaid = Timestamp.now();
  await updateDoc(doc(db, 'orders', orderId), payload);
  await addAuditLog('update', 'Orders', `Updated order ${orderId}`, { entityId: orderId, after: data });
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, 'orders', id));
  await addAuditLog('delete', 'Orders', `Deleted order ${id}`, { entityId: id });
}

// ── EXPENSES ─────────────────────────────────────────────────────────────────

export async function addExpense(data: Omit<Expense, 'id' | 'date' | 'receiptImageUrl'>): Promise<string> {
  const ref = await addDoc(collection(db, 'expenses'), { ...data, date: Timestamp.now() });
  await addAuditLog('create', 'Expenses', `Recorded expense ${data.description}`, { entityId: ref.id, after: data });
  return ref.id;
}

export async function getExpenses(): Promise<Expense[]> {
  return listAll<Expense>('expenses');
}

export function subscribeExpenses(cb: (rows: Expense[]) => void): Unsubscribe {
  return subscribe<Expense>('expenses', cb);
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', id));
  await addAuditLog('delete', 'Expenses', `Deleted expense ${id}`, { entityId: id });
}

// ── DASHBOARD STATS ──────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const [paidSnap, expensesSnap] = await Promise.all([
    getDocs(query(collection(db, 'orders'), where('status', '==', 'Paid'))),
    getDocs(collection(db, 'expenses')),
  ]);
  const totalRevenue = paidSnap.docs.reduce((s, d) => s + (d.data().grandTotal ?? 0), 0);
  const totalExpenses = expensesSnap.docs.reduce((s, d) => s + (d.data().amount ?? 0), 0);
  return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
}

// ── EMPLOYEES ────────────────────────────────────────────────────────────────

export async function addEmployee(data: Omit<Employee, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'employees'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Employees', `Created employee ${data.fullName}`, { entityId: ref.id });
  return ref.id;
}

export async function getEmployees(): Promise<Employee[]> {
  return listAll<Employee>('employees', orderBy('createdAt', 'desc'));
}

export function subscribeEmployees(cb: (rows: Employee[]) => void): Unsubscribe {
  return subscribe<Employee>('employees', cb, orderBy('createdAt', 'desc'));
}

export async function updateEmployee(id: string, data: Partial<Omit<Employee, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'employees', id), data);
  await addAuditLog('update', 'Employees', `Updated employee ${id}`, { entityId: id, after: data });
}

export async function deleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(db, 'employees', id));
  await addAuditLog('delete', 'Employees', `Deleted employee ${id}`, { entityId: id });
}

// ── DEPARTMENTS ──────────────────────────────────────────────────────────────

export async function addDepartment(data: Omit<Department, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'departments'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Departments', `Created department ${data.name}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeDepartments(cb: (rows: Department[]) => void): Unsubscribe {
  return subscribe<Department>('departments', cb, orderBy('name', 'asc'));
}

export async function getDepartments(): Promise<Department[]> {
  return listAll<Department>('departments', orderBy('name', 'asc'));
}

export async function updateDepartment(id: string, data: Partial<Omit<Department, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'departments', id), data);
  await addAuditLog('update', 'Departments', `Updated department ${id}`, { entityId: id, after: data });
}

export async function deleteDepartment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'departments', id));
  await addAuditLog('delete', 'Departments', `Deleted department ${id}`, { entityId: id });
}

// ── PROJECTS ─────────────────────────────────────────────────────────────────

export async function addProject(data: Omit<Project, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'projects'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Projects', `Created project ${data.name}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeProjects(cb: (rows: Project[]) => void): Unsubscribe {
  return subscribe<Project>('projects', cb, orderBy('createdAt', 'desc'));
}

export async function getProjects(): Promise<Project[]> {
  return listAll<Project>('projects', orderBy('createdAt', 'desc'));
}

export async function getProjectsByStatus(status: ProjectStatus): Promise<Project[]> {
  return listAll<Project>('projects', where('status', '==', status));
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, 'projects', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null;
}

export async function updateProject(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'projects', id), data);
  await addAuditLog('update', 'Projects', `Updated project ${id}`, { entityId: id, after: data });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, 'projects', id));
  await addAuditLog('delete', 'Projects', `Deleted project ${id}`, { entityId: id });
}

// ── TASKS ────────────────────────────────────────────────────────────────────

export async function addTask(data: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tasks'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await addAuditLog('create', 'Tasks', `Created task ${data.title}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeTasks(cb: (rows: Task[]) => void): Unsubscribe {
  return subscribe<Task>('tasks', cb, orderBy('createdAt', 'desc'));
}

export async function getTasks(): Promise<Task[]> {
  return listAll<Task>('tasks', orderBy('createdAt', 'desc'));
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return listAll<Task>('tasks', where('projectId', '==', projectId));
}

export function subscribeTasksByProject(projectId: string, cb: (rows: Task[]) => void): Unsubscribe {
  return subscribe<Task>('tasks', cb, where('projectId', '==', projectId));
}

export async function getTasksByDepartment(departmentId: string): Promise<Task[]> {
  return listAll<Task>('tasks', where('departmentId', '==', departmentId));
}

export async function getOverdueTasks(): Promise<Task[]> {
  const now = Timestamp.now();
  const tasks = await listAll<Task>('tasks', where('dueDate', '<', now));
  return tasks.filter((t) => t.status !== 'Done');
}

export async function updateTask(id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'tasks', id), { ...data, updatedAt: Timestamp.now() });
  await addAuditLog('update', 'Tasks', `Updated task ${id}`, { entityId: id, after: data });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tasks', id));
  await addAuditLog('delete', 'Tasks', `Deleted task ${id}`, { entityId: id });
}

// ── COMMENTS ─────────────────────────────────────────────────────────────────

export async function addComment(data: Omit<Comment, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'comments'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export function subscribeComments(taskId: string, cb: (rows: Comment[]) => void): Unsubscribe {
  return subscribe<Comment>('comments', cb, where('taskId', '==', taskId));
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', id));
}

// ── LEAVE REQUESTS ───────────────────────────────────────────────────────────

export async function addLeaveRequest(data: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'leaveRequests'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Leave', `Leave request by ${data.employeeName}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeLeaveRequests(cb: (rows: LeaveRequest[]) => void): Unsubscribe {
  return subscribe<LeaveRequest>('leaveRequests', cb, orderBy('createdAt', 'desc'));
}

export async function updateLeaveRequest(id: string, data: Partial<Omit<LeaveRequest, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'leaveRequests', id), data);
  await addAuditLog('update', 'Leave', `Leave request ${id} -> ${data.status ?? 'updated'}`, { entityId: id, after: data });
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'leaveRequests', id));
  await addAuditLog('delete', 'Leave', `Deleted leave request ${id}`, { entityId: id });
}

// ── LEAVE BALANCES ───────────────────────────────────────────────────────────

export async function addLeaveBalance(data: Omit<LeaveBalance, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'leaveBalances'), { ...data });
  return ref.id;
}

export function subscribeLeaveBalances(cb: (rows: LeaveBalance[]) => void): Unsubscribe {
  return subscribe<LeaveBalance>('leaveBalances', cb);
}

export async function updateLeaveBalance(id: string, data: Partial<Omit<LeaveBalance, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'leaveBalances', id), data);
}

// ── ATTENDANCE ───────────────────────────────────────────────────────────────

export async function addAttendanceRecord(data: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'attendance'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export function subscribeAttendance(cb: (rows: AttendanceRecord[]) => void): Unsubscribe {
  return subscribe<AttendanceRecord>('attendance', cb, orderBy('createdAt', 'desc'));
}

export async function getAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
  return listAll<AttendanceRecord>('attendance', where('date', '==', date));
}

export async function updateAttendanceRecord(id: string, data: Partial<Omit<AttendanceRecord, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'attendance', id), data);
}

// ── LEADS ────────────────────────────────────────────────────────────────────

export async function addLead(data: Omit<Lead, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'leads'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await addAuditLog('create', 'Leads', `Created lead ${data.company}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeLeads(cb: (rows: Lead[]) => void): Unsubscribe {
  return subscribe<Lead>('leads', cb, orderBy('createdAt', 'desc'));
}

export async function getLeads(): Promise<Lead[]> {
  return listAll<Lead>('leads', orderBy('createdAt', 'desc'));
}

export async function updateLead(id: string, data: Partial<Omit<Lead, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'leads', id), { ...data, updatedAt: Timestamp.now() });
  await addAuditLog('update', 'Leads', `Updated lead ${id}`, { entityId: id, after: data });
}

export async function deleteLead(id: string): Promise<void> {
  await deleteDoc(doc(db, 'leads', id));
  await addAuditLog('delete', 'Leads', `Deleted lead ${id}`, { entityId: id });
}

// ── DEALS ────────────────────────────────────────────────────────────────────

export async function addDeal(data: Omit<Deal, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'deals'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  await addAuditLog('create', 'Deals', `Created deal ${data.title}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeDeals(cb: (rows: Deal[]) => void): Unsubscribe {
  return subscribe<Deal>('deals', cb, orderBy('createdAt', 'desc'));
}

export async function getDeals(): Promise<Deal[]> {
  return listAll<Deal>('deals', orderBy('createdAt', 'desc'));
}

export async function updateDeal(id: string, data: Partial<Omit<Deal, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'deals', id), { ...data, updatedAt: Timestamp.now() });
  await addAuditLog('update', 'Deals', `Updated deal ${id}`, { entityId: id, after: data });
}

export async function deleteDeal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'deals', id));
  await addAuditLog('delete', 'Deals', `Deleted deal ${id}`, { entityId: id });
}

// ── ACTIVITIES ───────────────────────────────────────────────────────────────

export async function addActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'activities'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export function subscribeActivities(cb: (rows: Activity[]) => void): Unsubscribe {
  return subscribe<Activity>('activities', cb, orderBy('createdAt', 'desc'));
}

export function subscribeActivitiesByLead(leadId: string, cb: (rows: Activity[]) => void): Unsubscribe {
  return subscribe<Activity>('activities', cb, where('leadId', '==', leadId));
}

// ── CAMPAIGNS ────────────────────────────────────────────────────────────────

export async function addCampaign(data: Omit<Campaign, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'campaigns'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Campaigns', `Created campaign ${data.name}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeCampaigns(cb: (rows: Campaign[]) => void): Unsubscribe {
  return subscribe<Campaign>('campaigns', cb, orderBy('createdAt', 'desc'));
}

export async function getCampaigns(): Promise<Campaign[]> {
  return listAll<Campaign>('campaigns', orderBy('createdAt', 'desc'));
}

export async function updateCampaign(id: string, data: Partial<Omit<Campaign, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'campaigns', id), data);
  await addAuditLog('update', 'Campaigns', `Updated campaign ${id}`, { entityId: id, after: data });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(db, 'campaigns', id));
  await addAuditLog('delete', 'Campaigns', `Deleted campaign ${id}`, { entityId: id });
}

// ── INVOICES ─────────────────────────────────────────────────────────────────

export async function addInvoice(data: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'invoices'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Invoices', `Created invoice ${data.number}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeInvoices(cb: (rows: Invoice[]) => void): Unsubscribe {
  return subscribe<Invoice>('invoices', cb, orderBy('createdAt', 'desc'));
}

export async function getInvoices(): Promise<Invoice[]> {
  return listAll<Invoice>('invoices', orderBy('createdAt', 'desc'));
}

export async function updateInvoice(id: string, data: Partial<Omit<Invoice, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'invoices', id), data);
  await addAuditLog('update', 'Invoices', `Updated invoice ${id}`, { entityId: id, after: data });
}

export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, 'invoices', id));
  await addAuditLog('delete', 'Invoices', `Deleted invoice ${id}`, { entityId: id });
}

// ── QUOTATIONS ───────────────────────────────────────────────────────────────

export async function addQuotation(data: Omit<Quotation, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'quotations'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Quotations', `Created quotation ${data.number}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeQuotations(cb: (rows: Quotation[]) => void): Unsubscribe {
  return subscribe<Quotation>('quotations', cb, orderBy('createdAt', 'desc'));
}

export async function getQuotations(): Promise<Quotation[]> {
  return listAll<Quotation>('quotations', orderBy('createdAt', 'desc'));
}

export async function updateQuotation(id: string, data: Partial<Omit<Quotation, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'quotations', id), data);
  await addAuditLog('update', 'Quotations', `Updated quotation ${id}`, { entityId: id, after: data });
}

export async function deleteQuotation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'quotations', id));
  await addAuditLog('delete', 'Quotations', `Deleted quotation ${id}`, { entityId: id });
}

// ── PAYMENTS ─────────────────────────────────────────────────────────────────

export async function addPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'payments'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Payments', `Recorded payment for invoice ${data.invoiceId}`, { entityId: ref.id });
  return ref.id;
}

export function subscribePayments(cb: (rows: Payment[]) => void): Unsubscribe {
  return subscribe<Payment>('payments', cb, orderBy('createdAt', 'desc'));
}

export async function getPayments(): Promise<Payment[]> {
  return listAll<Payment>('payments', orderBy('createdAt', 'desc'));
}

export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'payments', id));
  await addAuditLog('delete', 'Payments', `Deleted payment ${id}`, { entityId: id });
}

// ── ASSETS ───────────────────────────────────────────────────────────────────

export async function addAsset(data: Omit<Asset, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'assets'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Assets', `Uploaded asset ${data.name}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeAssets(cb: (rows: Asset[]) => void): Unsubscribe {
  return subscribe<Asset>('assets', cb, orderBy('createdAt', 'desc'));
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'assets', id), data);
  await addAuditLog('update', 'Assets', `Updated asset ${id}`, { entityId: id, after: data });
}

export async function deleteAsset(id: string): Promise<void> {
  await deleteDoc(doc(db, 'assets', id));
  await addAuditLog('delete', 'Assets', `Deleted asset ${id}`, { entityId: id });
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────

export async function addNotification(data: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'notifications'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}

export function subscribeNotifications(cb: (rows: Notification[]) => void): Unsubscribe {
  return subscribe<Notification>('notifications', cb, orderBy('createdAt', 'desc'));
}

export async function markNotificationRead(id: string, read = true): Promise<void> {
  await updateDoc(doc(db, 'notifications', id), { read });
}

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notifications', id));
}

// ── SUPPLIERS ─────────────────────────────────────────────────────────────────

export async function addSupplier(data: Omit<Supplier, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'suppliers'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Suppliers', `Created supplier ${data.name}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeSuppliers(cb: (rows: Supplier[]) => void): Unsubscribe {
  return subscribe<Supplier>('suppliers', cb, orderBy('name', 'asc'));
}

export async function updateSupplier(id: string, data: Partial<Omit<Supplier, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'suppliers', id), data);
  await addAuditLog('update', 'Suppliers', `Updated supplier ${id}`, { entityId: id });
}

export async function deleteSupplier(id: string): Promise<void> {
  await deleteDoc(doc(db, 'suppliers', id));
  await addAuditLog('delete', 'Suppliers', `Deleted supplier ${id}`, { entityId: id });
}

// ── BILLS ─────────────────────────────────────────────────────────────────────

export async function addBill(data: Omit<Bill, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'bills'), { ...data, createdAt: Timestamp.now() });
  await addAuditLog('create', 'Bills', `Created bill: ${data.description}`, { entityId: ref.id });
  return ref.id;
}

export function subscribeBills(cb: (rows: Bill[]) => void): Unsubscribe {
  return subscribe<Bill>('bills', cb, orderBy('createdAt', 'desc'));
}

export async function updateBill(id: string, data: Partial<Omit<Bill, 'id' | 'createdAt'>>): Promise<void> {
  await updateDoc(doc(db, 'bills', id), data);
  await addAuditLog('update', 'Bills', `Updated bill ${id}`, { entityId: id });
}

export async function deleteBill(id: string): Promise<void> {
  await deleteDoc(doc(db, 'bills', id));
  await addAuditLog('delete', 'Bills', `Deleted bill ${id}`, { entityId: id });
}

// ── MONTHLY TARGETS ───────────────────────────────────────────────────────────

export function subscribeMonthlyTargets(cb: (rows: MonthlyTarget[]) => void): Unsubscribe {
  return subscribe<MonthlyTarget>('monthlyTargets', cb, orderBy('year', 'desc'));
}

export async function setMonthlyTarget(data: Omit<MonthlyTarget, 'id' | 'createdAt'>): Promise<string> {
  // upsert by year+month
  const existing = await getDocs(query(collection(db, 'monthlyTargets'),
    where('year', '==', data.year), where('month', '==', data.month)));
  if (!existing.empty) {
    await updateDoc(existing.docs[0].ref, data);
    return existing.docs[0].id;
  }
  const ref = await addDoc(collection(db, 'monthlyTargets'), { ...data, createdAt: Timestamp.now() });
  return ref.id;
}
