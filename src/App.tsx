import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth-context'
import { PageHeaderProvider } from '@/lib/page-header-context'
import AuthGuard from '@/components/AuthGuard'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import PageTransition from '@/components/PageTransition'
import { motion } from 'framer-motion'

const LoginPage         = lazy(() => import('@/pages/LoginPage'))
const DashboardPage     = lazy(() => import('@/pages/DashboardPage'))
const BusinessAnalyticsPage = lazy(() => import('@/pages/BusinessAnalyticsPage'))
// Operations
const ProjectsPage      = lazy(() => import('@/pages/projects/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage'))
const TasksPage         = lazy(() => import('@/pages/tasks/TasksPage'))
const ProjectManagementPage = lazy(() => import('@/pages/projects/ProjectManagementPage'))
const MaintenancePage    = lazy(() => import('@/pages/projects/MaintenancePage'))
// CRM & Sales
const LeadsPage         = lazy(() => import('@/pages/crm/LeadsPage'))
const CampaignsPage     = lazy(() => import('@/pages/crm/CampaignsPage'))
const CustomersPage     = lazy(() => import('@/pages/crm/CustomersPage'))
const ProductsPage      = lazy(() => import('@/pages/crm/ProductsPage'))
// Finance
const TransactionPage   = lazy(() => import('@/pages/finance/TransactionPage'))
const ExpensesPage      = lazy(() => import('@/pages/finance/ExpensesPage'))
const ReportsPage       = lazy(() => import('@/pages/finance/ReportsPage'))
const SuppliersPage     = lazy(() => import('@/pages/finance/SuppliersPage'))
// Human Resources
const EmployeesPage     = lazy(() => import('@/pages/hr/EmployeesPage'))
const LeavePage         = lazy(() => import('@/pages/hr/LeavePage'))
// System
const DepartmentsPage   = lazy(() => import('@/pages/departments/DepartmentsPage'))
const NotificationsPage = lazy(() => import('@/pages/system/NotificationsPage'))
const SettingsPage      = lazy(() => import('@/pages/system/SettingsPage'))

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
      <PageHeaderProvider>
        <div className="flex min-h-screen bg-neutral-50">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-auto">
              <PageTransition>
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </PageTransition>
            </main>
          </div>
        </div>
      </PageHeaderProvider>
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
              <Route path="/analytics" element={<BusinessAnalyticsPage />} />

              <Route path="/projects"    element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/tasks"       element={<TasksPage />} />
              <Route path="/project-management" element={<ProjectManagementPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />

              <Route path="/crm/leads"     element={<LeadsPage />} />
              <Route path="/crm/deals"     element={<Navigate to="/crm/leads" replace />} />
              <Route path="/crm/campaigns" element={<CampaignsPage />} />
              <Route path="/customers"     element={<CustomersPage />} />
              <Route path="/crm/products"  element={<ProductsPage />} />

              <Route path="/finance/transactions" element={<TransactionPage />} />
              <Route path="/finance/invoices"   element={<Navigate to="/finance/transactions" replace />} />
              <Route path="/finance/quotations" element={<Navigate to="/finance/transactions" replace />} />
              <Route path="/finance/expenses"   element={<ExpensesPage />} />
              <Route path="/finance/suppliers"  element={<SuppliersPage />} />
              <Route path="/finance/bills"      element={<Navigate to="/finance/expenses" replace />} />
              <Route path="/finance/subscriptions" element={<Navigate to="/finance/expenses" replace />} />
              <Route path="/finance/reports"    element={<ReportsPage />} />
              <Route path="/expenses" element={<Navigate to="/finance/expenses" replace />} />

              <Route path="/hr/employees"  element={<EmployeesPage />} />
              <Route path="/hr/leave"      element={<LeavePage />} />
              <Route path="/hr/attendance" element={<Navigate to="/hr/leave" replace />} />
              <Route path="/hr" element={<Navigate to="/hr/employees" replace />} />

              <Route path="/departments"   element={<DepartmentsPage />} />
              <Route path="/assets" element={<Navigate to="/departments" replace />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings"      element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
