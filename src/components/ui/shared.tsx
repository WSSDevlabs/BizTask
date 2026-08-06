import { cn } from '@/lib/utils';
import { Loader2, Search, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// ── LIVE COUNT-UP ──────────────────────────────────────────────────────────
// Animates a number from its previous value to a new target whenever the
// target changes (not just on mount) — used to make live Firestore-driven
// stats feel alive instead of snapping instantly.

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const from = firstRun.current ? 0 : fromRef.current;
    firstRun.current = false;
    const startTime = performance.now();
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return Number.isFinite(target) ? value : target;
}

// ── PAGE HEADER ──────────────────────────────────────────────────────────────

export function PageHeader({
  icon: Icon,
  title,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  /** @deprecated no longer rendered — page titles no longer show a description line */
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-100">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="bg-gradient-to-br from-neutral-900 to-black text-white p-2.5 rounded-xl shadow-sm shrink-0">
            <Icon size={22} />
          </div>
        )}
        <h1 className="text-xl font-bold text-neutral-900 tracking-tight leading-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// ── BUTTONS ──────────────────────────────────────────────────────────────────

export function PrimaryButton({
  children,
  className,
  isLoading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) {
  return (
    <button
      disabled={isLoading || props.disabled}
      className={cn(
        'relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-150',
        'bg-gradient-to-b from-sky-600 to-sky-700 shadow-sm shadow-sky-900/30',
        'hover:from-sky-500 hover:to-sky-600 hover:shadow-md hover:shadow-sky-900/25 hover:-translate-y-px',
        'active:translate-y-0 active:from-sky-700 active:to-sky-800 active:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm',
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-700 rounded-xl transition-all duration-150',
        'bg-white border border-neutral-200 shadow-sm',
        'hover:bg-neutral-50 hover:border-neutral-300 hover:-translate-y-px hover:shadow',
        'active:translate-y-0 active:bg-neutral-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  className,
  isLoading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isLoading?: boolean }) {
  return (
    <button
      disabled={isLoading || props.disabled}
      className={cn(
        'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-150',
        'bg-gradient-to-b from-red-600 to-red-700 shadow-sm',
        'hover:from-red-500 hover:to-red-600 hover:-translate-y-px hover:shadow-md',
        'active:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150',
        danger
          ? 'text-neutral-400 hover:bg-red-50 hover:text-red-600'
          : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── CARD ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className,
  hoverable,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-neutral-200/80 shadow-sm transition-all duration-300 hover:shadow-md',
        hoverable && 'hover:-translate-y-0.5 cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

// ── STAT CARD ────────────────────────────────────────────────────────────────

type StatTrend = 'up' | 'down' | 'neutral';
export type StatTone = 'blue' | 'emerald' | 'amber' | 'red';

const trendColors: Record<StatTrend, string> = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-neutral-400',
};

// Fixed semantic meaning, reused the same way on every page — never assigned
// randomly: blue = neutral/total, emerald = positive/on-track, amber =
// pending/attention, red = overdue/critical. `accent` is a legacy shorthand
// for tone="red" kept for existing call sites.
const statToneClasses: Record<StatTone, string> = {
  blue:    'bg-gradient-to-br from-sky-500 to-sky-600',
  emerald: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  amber:   'bg-gradient-to-br from-amber-500 to-amber-600',
  red:     'bg-gradient-to-br from-red-700 to-red-900',
};

function StatCardValue({ value }: { value: string | number }) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  if (typeof value !== 'number') return <>{value}</>;
  return <>{Math.round(animated).toLocaleString()}</>;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
  tone,
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  /** @deprecated use tone="red" instead */
  accent?: boolean;
  tone?: StatTone;
  trend?: StatTrend;
  trendLabel?: string;
}) {
  const resolvedTone = tone ?? (accent ? 'red' : undefined);
  return (
    <div className="group bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-5 h-full flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">{label}</span>
        <div
          className={cn(
            'p-2 rounded-xl shadow-sm text-white',
            resolvedTone ? statToneClasses[resolvedTone] : 'bg-gradient-to-br from-neutral-800 to-black'
          )}
        >
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-neutral-900 tabular-nums tracking-tight"><StatCardValue value={value} /></p>
      <div className="flex items-center gap-2 mt-1.5">
        {hint && <p className="text-xs text-neutral-400">{hint}</p>}
        {trend && trendLabel && (
          <span className={cn('text-xs font-semibold', trendColors[trend])}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ── STATUS BADGE ─────────────────────────────────────────────────────────────

type BadgeTone = 'green' | 'yellow' | 'red' | 'blue' | 'neutral' | 'black';

const toneClasses: Record<BadgeTone, string> = {
  green:   'bg-emerald-50 text-emerald-700 border border-emerald-200/80 ring-1 ring-emerald-100',
  yellow:  'bg-amber-50   text-amber-700   border border-amber-200/80   ring-1 ring-amber-100',
  red:     'bg-red-50     text-red-700     border border-red-200/80     ring-1 ring-red-100',
  blue:    'bg-blue-50    text-blue-700    border border-blue-200/80    ring-1 ring-blue-100',
  neutral: 'bg-neutral-50 text-neutral-600 border border-neutral-200/80',
  black:   'bg-neutral-900 text-white border border-neutral-800',
};

const dotClasses: Record<BadgeTone, string> = {
  green:   'bg-emerald-500',
  yellow:  'bg-amber-500',
  red:     'bg-red-500',
  blue:    'bg-blue-500',
  neutral: 'bg-neutral-400',
  black:   'bg-white',
};

export function StatusBadge({ label, tone, dot = true }: { label: string; tone: BadgeTone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide', toneClasses[tone])}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClasses[tone])} />}
      {label}
    </span>
  );
}

// ── SHARED STATUS->TONE MAPS ─────────────────────────────────────────────────

export function toneForStatus(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (['paid', 'won', 'active', 'approved', 'completed', 'accepted', 'present', 'done'].includes(s)) return 'green';
  if (['pending', 'in progress', 'sent', 'contacted', 'qualified', 'planning', 'review', 'late', 'on hold', 'partially paid', 'quoted', 'to do', 'negotiation', 'proposal'].includes(s)) return 'yellow';
  if (['overdue', 'lost', 'rejected', 'cancelled', 'expired', 'absent', 'critical'].includes(s)) return 'red';
  if (['draft', 'new', 'backlog'].includes(s)) return 'blue';
  return 'neutral';
}

export function toneForPriority(priority: string): BadgeTone {
  switch (priority) {
    case 'Critical': return 'red';
    case 'High':     return 'yellow';
    case 'Medium':   return 'blue';
    default:         return 'neutral';
  }
}

// ── LOADING / EMPTY ──────────────────────────────────────────────────────────

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
      <div className="relative mb-4">
        <div className="w-10 h-10 rounded-full border-2 border-neutral-100" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-red-800 border-t-transparent animate-spin" />
      </div>
      <p className="text-sm font-medium text-neutral-400">{label}</p>
    </div>
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 py-3 px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className={cn('skeleton h-4 rounded', i === 0 ? 'w-32' : 'flex-1')} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, label, description }: { icon: LucideIcon; label: string; description?: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-50 border border-neutral-100 mb-4">
        <Icon size={28} className="text-neutral-300" />
      </div>
      <p className="text-sm font-semibold text-neutral-500">{label}</p>
      {description && <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">{description}</p>}
    </div>
  );
}

// ── PROGRESS BAR ─────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercent,
  tone = 'red',
  size = 'md',
}: {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  tone?: 'red' | 'green' | 'blue' | 'amber' | 'neutral';
  size?: 'sm' | 'md';
}) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  const barColor = {
    red:     'bg-gradient-to-r from-red-700 to-red-500',
    green:   'bg-gradient-to-r from-emerald-600 to-emerald-400',
    blue:    'bg-gradient-to-r from-sky-600 to-sky-400',
    amber:   'bg-gradient-to-r from-amber-500 to-amber-400',
    neutral: 'bg-gradient-to-r from-neutral-500 to-neutral-400',
  }[tone];

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-neutral-500">{label}</span>}
          {showPercent && <span className="text-xs font-semibold text-neutral-700">{pct}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-neutral-100 rounded-full overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── FIELD ────────────────────────────────────────────────────────────────────

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder-neutral-300 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-800/30 focus:border-red-700 ' +
  'transition-all duration-150 text-sm shadow-sm hover:border-neutral-300';

export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-700 leading-none">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-600 text-xs font-medium flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-600" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── SEARCH INPUT ─────────────────────────────────────────────────────────────

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-700 transition-all duration-150 text-sm shadow-sm hover:border-neutral-300"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-300 hover:text-neutral-600 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ── DIVIDER ──────────────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  if (!label) return <hr className="border-neutral-100 my-4" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-neutral-100" />
      <span className="text-xs text-neutral-400 font-medium uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-neutral-100" />
    </div>
  );
}

// ── SECTION TITLE ─────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">{children}</h2>
  );
}
