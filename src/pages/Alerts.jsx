import { useStore } from '../store/useStore';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Check } from 'lucide-react';

const typeConfig = {
  success: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  warning: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
  danger:  { icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50 border-red-200' },
  info:    { icon: Info,          color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-200' },
};

export default function Alerts() {
  const { alerts, markAlertRead } = useStore();
  const unread = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-800">System Alerts</h1>
        <p className="text-sm text-gray-500">{unread} unread alerts</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['success','info','warning','danger'].map(type => {
          const { icon: Icon, color, bg } = typeConfig[type];
          const count = alerts.filter(a => a.type === type).length;
          return (
            <div key={type} className={`rounded-xl border p-4 flex items-center gap-3 ${bg}`}>
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <div className={`text-xl font-bold ${color}`}>{count}</div>
                <div className="text-xs text-gray-500 capitalize">{type}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const { icon: Icon, color, bg } = typeConfig[alert.type] || typeConfig.info;
          return (
            <div key={alert.id} className={`border rounded-2xl p-4 flex gap-4 items-start transition-opacity ${bg} ${alert.read ? 'opacity-60' : ''}`}>
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-sm">{alert.title}</span>
                  {!alert.read && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                </div>
                <p className="text-sm text-gray-600">{alert.message}</p>
                <div className="text-xs text-gray-400 mt-1">{alert.time}</div>
              </div>
              {!alert.read && (
                <button onClick={() => markAlertRead(alert.id)}
                  className="flex-shrink-0 p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 rounded-lg transition">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
