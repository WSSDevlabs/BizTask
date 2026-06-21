import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth-context'
import AuthGuard from '@/components/AuthGuard'
import Sidebar from '@/components/Sidebar'
import PageTransition from '@/components/PageTransition'
import { motion } from 'framer-motion'

const LoginPage         = lazy(() => import('@/pages/LoginPage'))
const DashboardPage     = lazy(() => import('@/pages/DashboardPage'))
// Operations
const ProjectsPage      = lazy(() => import('@/pages/projects/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage'))
const TasksPage         = lazy(() => import('@/pages/tasks/TasksPage'))
// CRM & Sales
const LeadsPage         = lazy(() => import('@/pages/crm/LeadsPage'))
const DealsPage         = lazy(() => import('@/pages/crm/DealsPage'))
const CampaignsPage     = lazy(() => import('@/pages/crm/CampaignsPage'))
const CustomersPage     = lazy(() => import('@/pages/crm/CustomersPage'))
const OrdersPage        = lazy(() => import('@/pages/crm/OrdersPage'))
// Finance
const InvoicesPage      = lazy(() => import('@/pages/finance/InvoicesPage'))
const QuotationsPage    = lazy(() => import('@/pages/finance/QuotationsPage'))
const ExpensesPage      = lazy(() => import('@/pages/finance/ExpensesPage'))
const ReportsPage       = lazy(() => import('@/pages/finance/ReportsPage'))
const SuppliersPage     = lazy(() => import('@/pages/finance/SuppliersPage'))
const BillsPage         = lazy(() => import('@/pages/finance/BillsPage'))
// Human Resources
const EmployeesPage     = lazy(() => import('@/pages/hr/EmployeesPage'))
const LeavePage         = lazy(() => import('@/pages/hr/LeavePage'))
const AttendancePage    = lazy(() => import('@/pages/hr/AttendancePage'))
// System
const AssetsPage        = lazy(() => import('@/pages/multimedia/AssetsPage'))
const DepartmentsPage   = lazy(() => import('@/pages/departments/DepartmentsPage'))
const AuditLogPage      = lazy(() => import('@/pages/system/AuditLogPage'))
const NotificationsPage = lazy(() => import('@/pages/system/NotificationsPage'))

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-7 h-7 rounded-full border-2 border-neutral-100 border-t-red-700"
      />
    </div>
  )
}

function DashboardLayout() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-neutral-50">
        <Sidebar />
        <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-auto">
          <PageTransition>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </main>
      </div>
    </AuthGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/projects"    element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/tasks"       element={<TasksPage />} />

              <Route path="/crm/leads"     element={<LeadsPage />} />
              <Route path="/crm/deals"     element={<DealsPage />} />
              <Route path="/crm/campaigns" element={<CampaignsPage />} />
              <Route path="/customers"     element={<CustomersPage />} />
              <Route path="/orders"        element={<OrdersPage />} />

              <Route path="/finance/invoices"   element={<InvoicesPage />} />
              <Route path="/finance/quotations" element={<QuotationsPage />} />
              <Route path="/finance/expenses"   element={<ExpensesPage />} />
              <Route path="/finance/suppliers"  element={<SuppliersPage />} />
              <Route path="/finance/bills"      element={<BillsPage />} />
              <Route path="/finance/reports"    element={<ReportsPage />} />
              <Route path="/expenses" element={<Navigate to="/finance/expenses" replace />} />

              <Route path="/hr/employees"  element={<EmployeesPage />} />
              <Route path="/hr/leave"      element={<LeavePage />} />
              <Route path="/hr/attendance" element={<AttendancePage />} />
              <Route path="/hr" element={<Navigate to="/hr/employees" replace />} />

              <Route path="/assets"        element={<AssetsPage />} />
              <Route path="/departments"   element={<DepartmentsPage />} />
              <Route path="/audit-log"     element={<AuditLogPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
