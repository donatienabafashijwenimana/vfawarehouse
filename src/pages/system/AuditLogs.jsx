import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatDateTime, prettyLabel } from '../../lib/format';

export default function AuditLogs() {
  const auditLogs = useStore((s) => s.auditLogs);
  const [moduleFilter, setModuleFilter] = useState('');

  const modules = Array.from(new Set(auditLogs.map((l) => l.module)));
  const rows = moduleFilter ? auditLogs.filter((l) => l.module === moduleFilter) : auditLogs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle="Every important action recorded with user, module and timestamp (spec §28)"
      />

      <DataTable
        columns={[
          { key: 'created_at', label: 'Date & Time', render: (l) => <span className="text-gray-500">{formatDateTime(l.created_at)}</span> },
          { key: 'user', label: 'User', render: (l) => (
            <div>
              <div className="font-medium text-gray-700">{l.user}</div>
              <div className="text-xs capitalize text-gray-400">{l.role}</div>
            </div>
          )},
          { key: 'module', label: 'Module', render: (l) => <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{l.module}</span> },
          { key: 'action', label: 'Action', render: (l) => <span className="text-gray-600">{l.action}</span> },
        ]}
        rows={rows}
        searchKeys={['user', 'action']}
        searchPlaceholder="Search user or action…"
        filters={
          <FilterSelect
            value={moduleFilter}
            onChange={setModuleFilter}
            placeholder="All modules"
            options={modules.map((m) => ({ value: m, label: prettyLabel(m) }))}
          />
        }
        pageSize={12}
      />
    </div>
  );
}
