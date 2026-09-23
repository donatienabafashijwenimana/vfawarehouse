import { CheckCheck, Bell, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/KPICard';
import { formatDateTime } from '../../lib/format';

const TYPE_STYLE = {
  warning: { icon: AlertTriangle, cls: 'bg-yellow-100 text-yellow-700' },
  success: { icon: CheckCircle2, cls: 'bg-green-100 text-green-700' },
  info: { icon: Info, cls: 'bg-blue-100 text-blue-700' },
  danger: { icon: AlertTriangle, cls: 'bg-red-100 text-red-700' },
};

export default function Notifications() {
  const notifications = useStore((s) => s.notifications);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Low stock, orders, quality checks, payments and account events (spec §29)"
        actions={unread > 0 && (
          <Button variant="secondary" onClick={markAllNotificationsRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read ({unread})
          </Button>
        )}
      />

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 py-16">
          <Bell className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
            const Icon = style.icon;
            return (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-5 py-4 text-left shadow-sm transition-colors ${n.read ? 'border-gray-100 bg-white opacity-70' : 'border-green-100 bg-white hover:border-green-200'}`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${style.cls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-green-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{n.message}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDateTime(n.created_at)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
