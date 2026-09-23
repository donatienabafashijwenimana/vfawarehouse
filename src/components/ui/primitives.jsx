// Shared UI primitives (spec §33): consistent buttons, badges, inputs, states.
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-green-700 text-white hover:bg-green-800 shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-gray-600 hover:bg-gray-100',
  };
  const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, color = 'gray', className = '' }) {
  const colors = {
    green: 'bg-green-100 text-green-700 ring-1 ring-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200',
    red: 'bg-red-100 text-red-700 ring-1 ring-red-200',
    gray: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
    blue: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    purple: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[color] ?? colors.gray} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const colors = {
    PLANNED: 'blue', IN_PROGRESS: 'yellow', COMPLETED: 'green', CANCELLED: 'gray',
    PENDING: 'yellow', CONFIRMED: 'blue', PROCESSING: 'purple', READY: 'blue',
    APPROVED: 'green', REJECTED: 'red', QUARANTINED: 'purple',
    PAID: 'green', PARTIAL: 'yellow', UNPAID: 'red',
    ACTIVE: 'green', INACTIVE: 'gray',
  };
  return (
    <Badge color={colors[status] ?? 'gray'}>
      {String(status ?? '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  );
}

const fieldCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent disabled:bg-gray-50';

export function Input({ label, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>}
      <input className={`${fieldCls} ${error ? 'border-red-300' : ''} ${className}`} {...props} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>}
      <select className={`${fieldCls} ${error ? 'border-red-300' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>}
      <textarea rows={3} className={`${fieldCls} ${error ? 'border-red-300' : ''} ${className}`} {...props} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${fieldCls} pl-9`}
      />
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = '' }) {
  return (
    <div className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent ${className}`} />
  );
}

export function Pagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
      <span className="text-xs text-gray-500">
        Page {page + 1} of {pageCount}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
