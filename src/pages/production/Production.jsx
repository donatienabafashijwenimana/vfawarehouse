import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, XCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea, StatusBadge } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate, formatNumber, prettyLabel } from '../../lib/format';
import { productionEfficiency } from '../../lib/calc';

const EMPTY = { product_id: '', input_qty: '', start_date: '', notes: '' };

export default function Production() {
  const batches = useStore((s) => s.batches);
  const products = useStore((s) => s.products);
  const varieties = useStore((s) => s.varieties);
  const seedClasses = useStore((s) => s.seedClasses);
  const startBatch = useStore((s) => s.startBatch);
  const cancelBatch = useStore((s) => s.cancelBatch);
  const deleteBatch = useStore((s) => s.deleteBatch);
  const inventory = useStore((s) => s.inventory);
  const run = useAction();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [complete, setComplete] = useState(null); // batch being completed
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? '—';

  const rows = statusFilter ? batches.filter((b) => b.status === statusFilter) : batches;

  const kpis = {
    active: batches.filter((b) => b.status === 'IN_PROGRESS').length,
    planned: batches.filter((b) => b.status === 'PLANNED').length,
    completed: batches.filter((b) => b.status === 'COMPLETED').length,
    output: batches.reduce((s, b) => s + (b.output_qty ?? 0), 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Batches"
        subtitle="Plan, track, and complete seed production"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Batch</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={Play} label="In Progress" value={kpis.active} tone="amber" />
        <KPICard icon={Plus} label="Planned" value={kpis.planned} tone="blue" />
        <KPICard icon={CheckCircle2} label="Completed" value={kpis.completed} tone="green" />
        <KPICard icon={CheckCircle2} label="Total Output" value={`${formatNumber(kpis.output)} kg`} tone="purple" />
      </div>

      <DataTable
        columns={[
          { key: 'batch_number', label: 'Batch', render: (b) => (
            <div>
              <button className="font-mono font-semibold text-green-700 hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/app/production/${b.id}`); }}>
                {b.batch_number}
              </button>
              <div className="text-xs text-gray-400">Started {formatDate(b.start_date ?? b.created_at)}</div>
            </div>
          )},
          { key: 'product_id', label: 'Product / Variety', render: (b) => (
            <div>
              <div className="text-sm text-gray-700">{nameOf(products, b.product_id)}</div>
              <div className="text-xs text-gray-400">{nameOf(varieties, b.variety_id)} · {nameOf(seedClasses, b.seed_class_id)}</div>
            </div>
          )},
          { key: 'input_qty', label: 'Input', render: (b) => <span className="text-gray-600">{formatNumber(b.input_qty)} kg</span> },
          { key: 'output_qty', label: 'Output', render: (b) => <span className="text-gray-600">{formatNumber(b.output_qty)} kg</span> },
          { key: 'efficiency', label: 'Efficiency', render: (b) => {
            const eff = productionEfficiency(b.input_qty, b.output_qty);
            return eff > 0 ? (
              <span className={`font-semibold ${eff >= 80 ? 'text-green-600' : eff >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{eff}%</span>
            ) : <span className="text-gray-300">—</span>;
          }},
          { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.status} /> },
          { key: 'quality_status', label: 'Quality', render: (b) => <StatusBadge status={b.quality_status} /> },
          { key: 'actions', label: '', sortable: false, render: (b) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {b.status === 'PLANNED' && (
                <Button size="sm" variant="secondary" onClick={() => run(() => startBatch(b.id), `Batch ${b.batch_number} started`)}>
                  <Play className="h-3.5 w-3.5" /> Start
                </Button>
              )}
              {b.status === 'IN_PROGRESS' && (
                <Button size="sm" onClick={() => setComplete(b)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </Button>
              )}
              {(b.status === 'PLANNED' || b.status === 'IN_PROGRESS') && (
                <Button size="sm" variant="ghost" onClick={() => run(() => cancelBatch(b.id), 'Batch cancelled')}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {can('production.delete') && b.status !== 'COMPLETED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={inventory.some((row) => row.batch_id === b.id)}
                  title={inventory.some((row) => row.batch_id === b.id) ? 'Remove or reassign this batch’s inventory first' : 'Delete batch'}
                  onClick={() => setBatchToDelete(b)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          )},
        ]}
        rows={rows}
        searchKeys={['batch_number']}
        searchPlaceholder="Search batch number…"
        filters={
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => ({ value: s, label: prettyLabel(s) }))}
          />
        }
        pageSize={8}
      />

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} products={products} varieties={varieties} seedClasses={seedClasses} />
      <CompleteBatchModal batch={complete} onClose={() => setComplete(null)} />
      <ConfirmDialog
        open={!!batchToDelete}
        onClose={() => setBatchToDelete(null)}
        title="Delete production batch"
        message={`Delete batch ${batchToDelete?.batch_number ?? ''}? Its production stages and quality checks will also be removed.`}
        confirmLabel="Delete batch"
        danger
        onConfirm={() => {
          if (batchToDelete) run(() => deleteBatch(batchToDelete.id), 'Batch deleted');
          setBatchToDelete(null);
        }}
      />
    </div>
  );
}

function CreateBatchModal({ open, onClose, products, varieties, seedClasses }) {
  const addBatch = useStore((s) => s.addBatch);
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedProduct = products.find((p) => p.id === form.product_id);

  function submit(e) {
    e.preventDefault();
    const input = Number(form.input_qty);
    if (!Number.isFinite(input) || input <= 0) return pushToast('Input quantity must be positive', 'error');
    try {
      addBatch({
        product_id: form.product_id,
        variety_id: selectedProduct?.variety_id,
        seed_class_id: selectedProduct?.seed_class_id,
        input_qty: input,
        start_date: form.start_date || new Date().toISOString().slice(0, 10),
        notes: form.notes,
      });
      pushToast('Production batch created', 'success');
      setForm(EMPTY);
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Production Batch">
      <form onSubmit={submit} className="space-y-4">
        <Select label="Product" value={form.product_id} onChange={set('product_id')} required>
          <option value="">Select product…</option>
          {products.filter((p) => p.status === 'ACTIVE').map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({varieties.find((v) => v.id === p.variety_id)?.name} · {seedClasses.find((c) => c.id === p.seed_class_id)?.name})
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Input quantity (kg)" type="number" min="1" value={form.input_qty} onChange={set('input_qty')} required />
          <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create Batch</Button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteBatchModal({ batch, onClose }) {
  const warehouses = useStore((s) => s.warehouses);
  const completeBatch = useStore((s) => s.completeBatch);
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState({ output_qty: '', rejected_qty: '', warehouse_id: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    try {
      completeBatch({
        batchId: batch.id,
        outputQty: Number(form.output_qty),
        rejectedQty: Number(form.rejected_qty || 0),
        warehouseId: form.warehouse_id || warehouses[0]?.id,
      });
      pushToast(`Batch ${batch.batch_number} completed`, 'success');
      onClose();
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  if (!batch) return null;
  return (
    <Modal open={!!batch} onClose={onClose} title={`Complete Batch ${batch.batch_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Input quantity: <strong>{formatNumber(batch.input_qty)} kg</strong>. Finished output will be added to inventory;
          rejected quantity is discarded (never sellable).
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Output quantity (kg)" type="number" min="0" value={form.output_qty} onChange={set('output_qty')} required />
          <Input label="Rejected quantity (kg)" type="number" min="0" value={form.rejected_qty} onChange={set('rejected_qty')} />
        </div>
        <Select label="Store output in warehouse" value={form.warehouse_id} onChange={set('warehouse_id')} required>
          <option value="">Select warehouse…</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </Select>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Complete Batch</Button>
        </div>
      </form>
    </Modal>
  );
}
