import { CheckCheck, Bell, AlertTriangle, CheckCircle2, Info, Trash2 } from 'lucide-react';
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
  const deleteNotification = useStore((s) => s.deleteNotification);
  const deleteReadNotifications = useStore((s) => s.deleteReadNotifications);
  const canDeleteNotification = useStore((s) => s.canDeleteNotification);
  const pushToast = useStore((s) => s.pushToast);

  const unread = notifications.filter((n) => !n.read).length;
  const clearable = notifications.filter((n) => n.read && canDeleteNotification(n)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Updates about stock, orders, quality checks, payments, and accounts"
        actions={
          (unread > 0 || clearable > 0) && (
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <Button variant="secondary" onClick={markAllNotificationsRead}>
                  <CheckCheck className="h-4 w-4" /> Mark all read ({unread})
                </Button>
              )}
              {clearable > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => pushToast(`Cleared ${deleteReadNotifications()} read notification(s)`, 'success')}
                >
                  <Trash2 className="h-4 w-4" /> Clear read ({clearable})
                </Button>
              )}
            </div>
          )
        }
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
            const isBroadcast = n.user_id == null;
            const canDelete = canDeleteNotification(n);
            return (
              // A div rather than a button: marking read and deleting are separate
              // actions, and a button inside a button is invalid and would fire the
              // outer one.
              <div
                key={n.id}
                className={`flex w-full items-start gap-3 rounded-2xl border px-5 py-4 text-left shadow-sm ${n.read ? 'border-gray-100 bg-white opacity-70' : 'border-green-100 bg-white'}`}
              >
                <button
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${style.cls}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{n.title}</span>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-green-500" />}
                      {isBroadcast && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                          Everyone
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{n.message}</p>
                  </div>
                  <span className="flex-shrink-0 text-xs text-gray-400">{formatDateTime(n.created_at)}</span>
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => deleteNotification(n.id)}
                    title="Delete notification"
                    aria-label={`Delete notification: ${n.title}`}
                    className="flex-shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  // Shown disabled rather than hidden, so it is clear the notification
                  // is not removable by this account and why.
                  <span
                    title={isBroadcast ? 'Only a manager can remove a notification for everyone' : 'You can only remove your own notifications'}
                    className="flex-shrink-0 p-1.5 text-gray-200"
                    aria-hidden="true"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
