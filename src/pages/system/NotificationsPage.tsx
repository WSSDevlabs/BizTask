import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell, Check, Trash2, AlertTriangle, CalendarClock, DollarSign, Trophy, XCircle,
} from "lucide-react";
import {
  Card, LoadingState, EmptyState,
} from "@/components/ui/shared";
import { usePageHeader } from "@/lib/page-header-context";
import {
  subscribeNotifications, markNotificationRead, deleteNotification,
} from "@/lib/db";
import { cn, formatDate, toJsDate } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

const typeIcon: Record<NotificationType, typeof Bell> = {
  overdue_task: AlertTriangle,
  leave_pending: CalendarClock,
  payment_overdue: DollarSign,
  deal_won: Trophy,
  deal_lost: XCircle,
  general: Bell,
};

const typeColor: Record<NotificationType, string> = {
  overdue_task: "text-red-600 bg-red-50",
  leave_pending: "text-amber-600 bg-amber-50",
  payment_overdue: "text-red-600 bg-red-50",
  deal_won: "text-green-600 bg-green-50",
  deal_lost: "text-neutral-500 bg-neutral-100",
  general: "text-blue-600 bg-blue-50",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    const unsub = subscribeNotifications((rows) => { setNotifications(rows); setLoading(false); });
    return unsub;
  }, []);

  const shown = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markNotificationRead(n.id)));
  }

  usePageHeader({ actions: unreadCount > 0 ? <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-red-800 hover:underline"><Check size={15} /> Mark all read</button> : undefined });

  if (loading) return <LoadingState />;

  return (
    <div className="max-w-3xl mx-auto">

      <div className="flex gap-2 mb-4">
        {(["all", "unread"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-black text-white" : "bg-white border border-neutral-200 text-neutral-600"}`}>{t}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState icon={Bell} label="No notifications" /></Card>
      ) : (
        <div className="space-y-2">
          {shown.map((n) => {
            const Icon = typeIcon[n.type];
            const body = (
              <Card className={cn("p-4 flex items-start gap-3", !n.read && "border-l-4 border-l-red-800")}>
                <div className={cn("p-2 rounded-lg", typeColor[n.type])}><Icon size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", n.read ? "text-neutral-600" : "font-semibold text-black")}>{n.title}</p>
                  {n.body && <p className="text-sm text-neutral-500 mt-0.5">{n.body}</p>}
                  <p className="text-xs text-neutral-400 mt-1">{n.createdAt ? formatDate(toJsDate(n.createdAt)!) : ""}</p>
                </div>
                <div className="flex gap-1">
                  {!n.read && <button onClick={(e) => { e.preventDefault(); markNotificationRead(n.id); }} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500" title="Mark read"><Check size={14} /></button>}
                  <button onClick={(e) => { e.preventDefault(); deleteNotification(n.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                </div>
              </Card>
            );
            return n.link ? <Link key={n.id} to={n.link} onClick={() => markNotificationRead(n.id)}>{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}
