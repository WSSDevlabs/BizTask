# BizTask — Internal ERP

A full-featured internal ERP system built for Malaysian startups and SMEs. Manages the complete business lifecycle: CRM, Finance, Projects, HR, and Multimedia Assets — in a single unified platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Vite 6 |
| Styling | Tailwind CSS 4, Framer Motion |
| UI Components | Radix UI (via shadcn/ui), Lucide React |
| Backend / DB | Firebase (Auth, Firestore, Storage) |
| Forms | React Hook Form + Zod |
| Routing | React Router v7 |
| PDF | @react-pdf/renderer |
| CI/CD | GitHub Actions → Firebase Hosting |

## Modules

- **Dashboard** — CEO command center: morning briefing, KPIs, Business Health Score, quick actions
- **Projects & Tasks** — Kanban board, project detail, team assignments
- **CRM & Sales** — Lead pipeline (7 stages), deals, customers, campaigns, orders
- **Finance** — Invoices (`BZT/INV/`), quotations (`BZT/QT/`), expenses, suppliers, bills/payables, P&L reports
- **Human Resources** — Employee management, leave approval, attendance tracking
- **Assets** — Multimedia asset library with Firebase Storage upload
- **System** — Departments, audit log (immutable), notifications

## Project Structure

```
src/
├── components/
│   ├── ui/           # Shared design system (shared.tsx, button.tsx, dialog.tsx)
│   ├── finance/      # LineItemEditor (SST tax per line)
│   ├── pdf/          # PDF document templates + download button
│   ├── AuthGuard.tsx
│   ├── DeleteConfirmModal.tsx
│   ├── PageTransition.tsx
│   └── Sidebar.tsx
├── lib/
│   ├── auth-context.tsx  # Role-based auth (Executive | HR | Staff)
│   ├── backend-utils.ts  # Firebase auth helpers
│   ├── db.ts             # Firestore CRUD + realtime subscriptions
│   ├── env.ts            # Startup env validation
│   ├── firebase.ts
│   ├── utils.ts
│   └── validations.ts    # Zod schemas
├── pages/
│   ├── DashboardPage.tsx
│   ├── LoginPage.tsx
│   ├── crm/              # Leads, Deals, Campaigns, Customers, Orders
│   ├── finance/          # Invoices, Quotations, Expenses, Suppliers, Bills, Reports
│   ├── hr/               # Employees, Leave, Attendance
│   ├── projects/         # Projects, ProjectDetail
│   ├── tasks/
│   ├── departments/
│   ├── multimedia/
│   └── system/           # AuditLog, Notifications
└── types/
    └── index.ts          # All TypeScript types
```

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/WSSDevlabs/BizTask.git
cd BizTask
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in all VITE_FIREBASE_* values from your Firebase console
# Set VITE_HR_MASTER_EMAIL and VITE_HR_LOGIN_SHORTCUT
```

### 3. Run locally

```bash
npm run dev
```

### 4. Validate before push

```bash
npm run validate   # typecheck + lint + build
```

## Environment Variables

See [.env.example](.env.example) for the full list. All `VITE_FIREBASE_*` variables are required. The app will throw on startup if any are missing.

## Role System

| Role | Access |
|---|---|
| `Executive` | Full access to all modules |
| `HR` | HR module only (Employees, Leave, Attendance, Departments) |
| `Staff` | Projects, Tasks, CRM, Finance (no HR admin, no Reports) |

## CI/CD

- **CI** (`.github/workflows/ci.yml`): TypeScript check + ESLint + build on every push/PR
- **CD** (`.github/workflows/deploy.yml`): Deploys to Firebase Hosting on merge to `main`

Required GitHub Secrets: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_HR_MASTER_EMAIL`, `VITE_HR_LOGIN_SHORTCUT`, `FIREBASE_TOKEN`

## Security

- Firestore rules enforce role-based access at the database level
- Audit logs are immutable (`update` and `delete` blocked by rules)
- Storage rules enforce file-size limits per collection
- Security headers configured in `firebase.json`
