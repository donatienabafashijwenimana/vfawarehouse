import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { MOVEMENT_TYPES } from '../../store/slices/warehouseSlice';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatNumber, formatDateTime, prettyLabel } from '../../lib/format';

export default function StockMovements() {
  const movements = useStore((s) => s.movements);
  const products = useStore((s) => s.products);
  const warehouses = useStore((s) => s.warehouses);
  const batches = useStore((s) => s.batches);
  const [typeFilter, setTypeFilter] = useState('');

  const productName = (id) => products.find((p) => p.id === id)?.name ?? '—';
  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name ?? '—';
  const batchNo = (id) => batches.find((b) => b.id === id)?.batch_number ?? 'Bulk';

  const rows = typeFilter ? movements.filter((m) => m.movement_type === typeFilter) : movements;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        subtitle="Review every change to inventory"
      />

      <DataTable
        columns={[
          { key: 'created_at', label: 'Date', render: (m) => <span className="text-gray-500">{formatDateTime(m.created_at)}</span> },
          { key: 'product_id', label: 'Product', render: (m) => (
            <div>
              <div className="font-medium text-gray-700">{productName(m.product_id)}</div>
              <div className="font-mono text-xs text-gray-400">{batchNo(m.batch_id)}</div>
            </div>
          )},
          { key: 'movement_type', label: 'Type', render: (m) => <StatusBadge status={m.movement_type} /> },
          { key: 'quantity', label: 'Quantity', render: (m) => <span className="font-semibold text-gray-700">{formatNumber(m.quantity)} kg</span> },
          { key: 'warehouse_id', label: 'Warehouse', render: (m) => <span className="text-gray-600">{warehouseName(m.warehouse_id)}</span> },
          { key: 'reference_type', label: 'Reference', render: (m) => (
            <span className="text-xs text-gray-400">
              {m.reference_type ? `${prettyLabel(m.reference_type)}${m.reference_id ? ` · ${m.reference_id.slice(0, 8)}` : ''}` : '—'}
            </span>
          )},
          { key: 'notes', label: 'Notes', render: (m) => <span className="text-gray-500">{m.notes}</span> },
          { key: 'created_by', label: 'By', render: (m) => <span className="text-gray-500">{m.created_by}</span> },
        ]}
        rows={rows}
        searchKeys={['notes', 'created_by']}
        searchPlaceholder="Search notes or user…"
        filters={
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="All types"
            options={MOVEMENT_TYPES.map((t) => ({ value: t, label: prettyLabel(t) }))}
          />
        }
        pageSize={12}
      />
    </div>
  );
}
