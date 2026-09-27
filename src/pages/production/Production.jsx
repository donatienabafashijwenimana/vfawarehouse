import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, XCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PRODUCTION_STATUSES, QUALITY_STATUSES, generateBatchNumber } from '../../store/slices/productionSlice';
import { batchesApi, batchStorageMissing } from '../../services/dataService';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea, StatusBadge } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate, formatNumber, prettyLabel } from '../../lib/format';
import { productionEfficiency } from '../../lib/calc';
import { unitOf } from '../../lib/units';

const EMPTY = { product_id: '', input_qty: '', start_date: '', warehouse_id: '', notes: '' };
const EMPTY_COMPLETION = { output_qty: '', rejected_qty: '', warehouse_id: '', output_product_id: '' };

export default function Production() {
  const batches = useStore((s) => s.batches);
  const products = useStore((s) => s.products);
  const varieties = useStore((s) => s.varieties);
  const seedClasses = useStore((s) => s.seedClasses);
  const warehouses = useStore((s) => s.warehouses);
  const startBatch = useStore((s) => s.startBatch);
  const cancelBatch = useStore((s) => s.cancelBatch);
  const deleteBatch = useStore((s) => s.deleteBatch);
  const inventory = useStore((s) => s.inventory);
  const flushDatabaseSync = useStore((s) => s.flushDatabaseSync);
  const pushToast = useStore((s) => s.pushToast);
  const run = useAction();
  const { can, canAny } = usePermissions();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [complete, setComplete] = useState(null); // batch being completed
  const [edit, setEdit] = useState(null); // batch being edited
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState(null); // batch with a status write in flight

  const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? '—';
  const unitForProduct = (productId) => unitOf(products.find((p) => p.id === productId));
  /** What a batch actually produced, which is not always what was planted. */
  const outputProductId = (batch) => batch.output_product_id ?? batch.product_id;
  /** Efficiency is output ÷ input, so it needs both in the same product. */
  const efficiencyComparable = (batch) => outputProductId(batch) === batch.product_id;

  // The same permissions the database enforces, so a button is never offered for
  // a write that will be refused. Completing also books stock, which row-level
  // security gates on the inventory permissions rather than the production ones.
  const canEdit = can('production.update');
  const canBookStock = canAny(['inventory.update', 'inventory.adjust']);

  /**
   * A status change is written to the database before the store is told about it.
   * Updating the store and hoping the debounced sync would land is what made a
   * Start look successful while never being recorded: row-level security simply
   * hid the row, the update matched zero rows, and PostgreSQL raises no error for
   * that. Writing first means a refused change is reported as refused and leaves
   * no phantom status behind.
   */
  async function saveTransition(batch, fields, apply, successMessage) {
    setBusy(batch.id);
    try {
      await batchesApi.update(batch.id, fields);
      apply();
      useStore.getState().markSynced('batches');
      pushToast(successMessage, 'success');
    } catch (error) {
      pushToast(`Could not save ${batch.batch_number}: ${error.message}`, 'error');
    } finally {
      setBusy(null);
    }
  }

  const start = (batch) =>
    saveTransition(
      batch,
      { status: 'IN_PROGRESS', start_date: new Date().toISOString().slice(0, 10) },
      () => startBatch(batch.id),
      `Batch ${batch.batch_number} started`
    );

  const cancel = (batch) =>
    saveTransition(batch, { status: 'CANCELLED' }, () => cancelBatch(batch.id), `Batch ${batch.batch_number} cancelled`);

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

      {batchStorageMissing() && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          <p className="font-semibold">Storage warehouse is not available on this database</p>
          <p className="mt-1">
            The batches below loaded without their storage warehouse, so the Storage column is blank and batch storage
            cannot be edited or required on completion. Everything else on this page works. Applying
            supabase/migrations/20260927000016_batch_storage_warehouse.sql to the database turns it back on — this page
            picks it up on the next reload, with no redeploy.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={Play} label="In Progress" value={kpis.active} tone="amber" />
        <KPICard icon={Plus} label="Planned" value={kpis.planned} tone="blue" />
        <KPICard icon={CheckCircle2} label="Completed" value={kpis.completed} tone="green" />
        <KPICard icon={CheckCircle2} label="Total Output" value={formatNumber(kpis.output)} sub="Across all products (units vary)" tone="purple" />
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
          { key: 'product_id', label: 'Planted / Variety', render: (b) => (
            <div>
              <div className="text-sm text-gray-700">{nameOf(products, b.product_id)}</div>
              <div className="text-xs text-gray-400">{nameOf(varieties, b.variety_id)} · {nameOf(seedClasses, b.seed_class_id)}</div>
            </div>
          )},
          { key: 'input_qty', label: 'Input', render: (b) => <span className="text-gray-600">{formatNumber(b.input_qty)} {unitForProduct(b.product_id)}</span> },
          { key: 'output_qty', label: 'Output', render: (b) => {
            // The output is not always what was planted, and it is counted in the
            // output product's unit, so both name and unit follow that product.
            const changed = (b.output_product_id ?? b.product_id) !== b.product_id;
            return (
              <div>
                <div className="text-gray-600">{formatNumber(b.output_qty)} {unitForProduct(outputProductId(b))}</div>
                {changed && <div className="text-xs text-amber-600">as {nameOf(products, b.output_product_id)}</div>}
              </div>
            );
          } },
          { key: 'efficiency', label: 'Efficiency', render: (b) => {
            // Output ÷ input only means something when both are the same product
            // in the same unit, so a batch that changes product shows nothing.
            if (!efficiencyComparable(b)) return <span className="text-gray-300" title="Not comparable: this batch changed product">—</span>;
            const eff = productionEfficiency(b.input_qty, b.output_qty);
            return eff > 0 ? (
              <span className={`font-semibold ${eff >= 80 ? 'text-green-600' : eff >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{eff}%</span>
            ) : <span className="text-gray-300">—</span>;
          }},
          { key: 'warehouse_id', label: 'Storage', render: (b) => {
            const name = warehouses.find((w) => w.id === b.warehouse_id)?.name;
            // A batch with no warehouse yet has output nowhere to go, which the
            // completion form will not allow. Worth saying before it is a surprise.
            if (!name) {
              return (
                <div className="text-sm text-amber-600">
                  Not set
                  <div className="text-xs text-gray-400">Set one before completing</div>
                </div>
              );
            }
            const stocked = inventory.some((row) => row.batch_id === b.id);
            return (
              <div>
                <div className="text-gray-600">{name}</div>
                {!stocked && b.status === 'COMPLETED' && (
                  <div className="text-xs text-gray-400">No stock on the shelf</div>
                )}
              </div>
            );
          } },
          { key: 'status', label: 'Status', render: (b) => <StatusBadge status={b.status} /> },
          { key: 'quality_status', label: 'Quality', render: (b) => <StatusBadge status={b.quality_status} /> },
          { key: 'actions', label: '', sortable: false, render: (b) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {b.status === 'PLANNED' && (
                <Button
                  size="sm" variant="secondary"
                  disabled={!canEdit || busy === b.id}
                  title={canEdit ? 'Start production' : 'You need the production.update permission to start a batch'}
                  onClick={() => start(b)}
                >
                  <Play className="h-3.5 w-3.5" /> Start
                </Button>
              )}
              {b.status === 'IN_PROGRESS' && (
                <Button
                  size="sm"
                  disabled={!canEdit || !canBookStock}
                  title={!canEdit
                    ? 'You need the production.update permission to complete a batch'
                    : !canBookStock
                      ? 'Completing a batch books the output into stock, which needs the inventory.adjust permission'
                      : 'Complete production and book the output into stock'}
                  onClick={() => setComplete(b)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </Button>
              )}
              {(b.status === 'PLANNED' || b.status === 'IN_PROGRESS') && (
                <Button
                  size="sm" variant="ghost"
                  disabled={!canEdit || busy === b.id}
                  title={canEdit ? 'Cancel batch' : 'You need the production.update permission to cancel a batch'}
                  onClick={() => cancel(b)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {can('production.update') && (
                <Button size="sm" variant="ghost" title="Edit batch" onClick={() => setEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {can('production.delete') && (
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
            options={PRODUCTION_STATUSES.map((s) => ({ value: s, label: prettyLabel(s) }))}
          />
        }
        pageSize={8}
      />

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} products={products} varieties={varieties} seedClasses={seedClasses} warehouses={warehouses} />
      <CompleteBatchModal batch={complete} onClose={() => setComplete(null)} products={products} varieties={varieties} seedClasses={seedClasses} flushDatabaseSync={flushDatabaseSync} />
      {edit && (
        <EditBatchModal
          key={edit.id}
          batch={edit}
          onClose={() => setEdit(null)}
          products={products}
          varieties={varieties}
          seedClasses={seedClasses}
          warehouses={warehouses}
        />
      )}
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

function CreateBatchModal({ open, onClose, products, varieties, seedClasses, warehouses }) {
  const addBatch = useStore((s) => s.addBatch);
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedProduct = products.find((p) => p.id === form.product_id);

  async function submit(e) {
    e.preventDefault();
    const input = Number(form.input_qty);
    if (!Number.isFinite(input) || input <= 0) return pushToast('Input quantity must be positive', 'error');
    setSaving(true);
    try {
      // Insert into the database FIRST, directly through the API. The insert
      // returns the saved row, or throws the database's real error (RLS,
      // constraint, connection) — success can never be claimed without a row.
      const payload = {
        batch_number: generateBatchNumber(useStore.getState().batches),
        product_id: form.product_id,
        variety_id: selectedProduct?.variety_id ?? null,
        seed_class_id: selectedProduct?.seed_class_id ?? null,
        input_qty: input,
        start_date: form.start_date || new Date().toISOString().slice(0, 10),
        warehouse_id: form.warehouse_id || null,
        notes: form.notes,
        status: 'PLANNED',
        quality_status: 'PENDING',
        created_by: useStore.getState().profile?.id ?? null,
      };
      const saved = await batchesApi.create(payload);
      addBatch(saved); // mirror the confirmed row into the store (+ stage pipeline)
      useStore.getState().markSynced?.('batches');
      pushToast(`Batch ${saved.batch_number} inserted into database`, 'success');
      setForm(EMPTY);
      onClose();
    } catch (err) {
      pushToast(`Database insert failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
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
          <Input label={`Input quantity (${selectedProduct?.unit ?? 'kg'})`} type="number" min="1" value={form.input_qty} onChange={set('input_qty')} required />
          <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
        </div>
        <WarehouseField warehouses={warehouses} value={form.warehouse_id} onChange={set('warehouse_id')} />
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create Batch'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The warehouse a batch is stored in, and where it is on every batch form.
 *
 * Required throughout. An open batch records where its output is destined for, so
 * the destination is a decision made when the batch is planned rather than at the
 * keyboard of whoever completes it; the database refuses to complete a batch
 * without one, and refuses any edit that would leave a completed batch pointing at
 * nowhere. On a completed batch this is the batch's actual whereabouts, and
 * changing it moves the stock.
 */
function WarehouseField({ warehouses, value, onChange, label = 'Storage warehouse' }) {
  // Keep the batch's current selection visible even if that warehouse was
  // deactivated, or saving an unrelated edit would silently drop it.
  const options = warehouses.filter((w) => w.status === 'ACTIVE' || w.id === value);

  return (
    <>
      <Select label={label} value={value} onChange={onChange} required>
        <option value="">Select warehouse…</option>
        {options.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </Select>
      {options.length === 0 && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          No warehouses have been set up yet, so there is nowhere to store this batch. Add one under
          Warehouse first.
        </div>
      )}
    </>
  );
}

/**
 * What the batch actually produced. A farmer plants one product and can finish
 * with another, so the operator names the output product and the quantities below
 * are counted in that product's own unit. The stock is booked against the output
 * product, and because the two products are different there is nothing to convert
 * between them, so no factor is asked for. Choosing the planted product keeps the
 * input and output comparable and leaves efficiency meaningful.
 */
function OutputProductFields({ batch, form, set, products, varieties, seedClasses, plantedProduct }) {
  const outputProduct = products.find((p) => p.id === form.output_product_id) ?? plantedProduct;
  const unit = unitOf(outputProduct);
  const changed = outputProduct && plantedProduct && outputProduct.id !== plantedProduct.id;
  const active = products.filter((p) => p.status === 'ACTIVE');

  return (
    <>
      <Select label="What did this batch produce?" value={form.output_product_id} onChange={set('output_product_id')} required>
        <option value="">Select product…</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({unitOf(p)} · {varieties.find((v) => v.id === p.variety_id)?.name} · {seedClasses.find((c) => c.id === p.seed_class_id)?.name}){p.id === batch.product_id ? ' — as planted' : ''}
          </option>
        ))}
      </Select>
      {changed && (
        <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
          Planted as <strong>{plantedProduct.name}</strong> ({unitOf(plantedProduct)}), finishing as{' '}
          <strong>{outputProduct.name}</strong>. Output and rejected are counted in {unit} and the finished stock is
          added to <strong>{outputProduct.name}</strong>. Efficiency is not shown for a batch that changes product,
          because the input and the output are no longer the same thing.
        </div>
      )}
    </>
  );
}

function CompleteBatchModal({ batch, onClose, products, varieties, seedClasses, flushDatabaseSync }) {
  const warehouses = useStore((s) => s.warehouses);
  const resolveBatchCompletion = useStore((s) => s.resolveBatchCompletion);
  const applyBatchCompletion = useStore((s) => s.applyBatchCompletion);
  const markSynced = useStore((s) => s.markSynced);
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState(() => ({ ...EMPTY_COMPLETION, warehouse_id: batch?.warehouse_id ?? '' }));
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      // Settle anything the debounced sync is still holding first, so it cannot
      // write a stale inventory snapshot after this completion has landed.
      const settled = flushDatabaseSync ? await flushDatabaseSync() : { ok: true };
      if (!settled.ok) throw new Error(`An earlier change is still unsaved: ${settled.message}`);

      // Checked here, applied after the write, so a bad figure never reaches the
      // database and the numbers the function records are the ones validated.
      const resolved = resolveBatchCompletion({
        batchId: batch.id,
        outputQty: Number(form.output_qty),
        rejectedQty: Number(form.rejected_qty || 0),
        // Not defaulted to some warehouse: the select above is required, and if a
        // value ever arrives empty the refusal below names the batch, rather than
        // the output being quietly booked into a warehouse nobody chose.
        warehouseId: form.warehouse_id || batch.warehouse_id || null,
        outputProductId: form.output_product_id || batch.product_id,
      });

      // One transaction marks the batch COMPLETED, books the output into stock
      // and writes the movement. There is no window in which stock is booked for
      // a completion the database did not record, and no retry that books it twice.
      const confirmed = await batchesApi.completeBatch({
        batchId: resolved.batch.id,
        outputQty: resolved.output,
        rejectedQty: resolved.rejected,
        warehouseId: resolved.warehouseId,
        outputProductId: resolved.productId,
      });

      applyBatchCompletion(confirmed);
      // These three slices now hold exactly the rows the database returned, so
      // the diff-sync has nothing to add and must not re-write them.
      markSynced('batches', 'inventory', 'movements');
      pushToast(`Batch ${batch.batch_number} completed and saved`, 'success');
      onClose();
    } catch (err) {
      // Nothing was written to the store on the way in, so there is nothing to
      // roll back here: the completion either landed whole or did not happen.
      pushToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!batch) return null;
  const plantedProduct = products.find((p) => p.id === batch.product_id);
  const plantedUnit = unitOf(plantedProduct);
  const outputProduct = products.find((p) => p.id === (form.output_product_id || batch.product_id));
  const countUnit = unitOf(outputProduct);
  return (
    <Modal open={!!batch} onClose={onClose} title={`Complete Batch ${batch.batch_number}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          Input quantity: <strong>{formatNumber(batch.input_qty)} {plantedUnit}</strong>. Finished output will be added to inventory;
          rejected quantity is discarded (never sellable).
        </div>
        <OutputProductFields batch={batch} form={form} set={set} products={products} varieties={varieties} seedClasses={seedClasses} plantedProduct={plantedProduct} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={`Output quantity (${countUnit})`} type="number" min="0" value={form.output_qty} onChange={set('output_qty')} required />
          <Input label={`Rejected quantity (${countUnit})`} type="number" min="0" value={form.rejected_qty} onChange={set('rejected_qty')} />
        </div>
        <WarehouseField warehouses={warehouses} value={form.warehouse_id} onChange={set('warehouse_id')} label="Store output in warehouse" />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Complete Batch'}</Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Edit any batch, including a COMPLETED one.
 *
 * A correction on a completed batch carries its warehouse stock with it: the
 * output quantity and output product are written to the stock row and the
 * PRODUCTION movement that booked them, so the batch and the shelf cannot drift
 * apart. The database refuses the corrections that would rewrite history — once
 * the stock has been sold, reserved, quarantined or written off, or once the
 * batch is quality approved, the quantity is what it was inspected as and stays
 * put. Reopening releases the stock instead of leaving it stranded, so
 * completing the batch again books the output once.
 */
function EditBatchModal({ batch, onClose, products, varieties, seedClasses, warehouses }) {
  const applyBatchEdit = useStore((s) => s.applyBatchEdit);
  const snapshotWrite = useStore((s) => s.snapshotWrite);
  const restoreWrite = useStore((s) => s.restoreWrite);
  const pushToast = useStore((s) => s.pushToast);
  const [saving, setSaving] = useState(false);
  // Output and rejected are held as the count an operator would type, which is
  // the output product's own unit — the same unit the record stores.
  const [form, setForm] = useState(() => ({
    batch_number: batch.batch_number ?? '',
    product_id: batch.product_id ?? '',
    variety_id: batch.variety_id ?? '',
    seed_class_id: batch.seed_class_id ?? '',
    input_qty: String(batch.input_qty ?? ''),
    output_qty: String(batch.output_qty ?? ''),
    rejected_qty: String(batch.rejected_qty ?? ''),
    output_product_id: batch.output_product_id ?? batch.product_id ?? '',
    start_date: batch.start_date ?? '',
    end_date: batch.end_date ?? '',
    status: batch.status ?? 'PLANNED',
    quality_status: batch.quality_status ?? 'PENDING',
    warehouse_id: batch.warehouse_id ?? '',
    notes: batch.notes ?? '',
  }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Keep the batch's current selection visible even if that record was deactivated.
  const productOptions = products.filter((p) => p.status === 'ACTIVE' || p.id === batch.product_id);
  const varietyOptions = varieties.filter((v) => v.status === 'ACTIVE' || v.id === batch.variety_id);
  const seedClassOptions = seedClasses.filter((c) => c.status === 'ACTIVE' || c.id === batch.seed_class_id);

  const wasCompleted = batch.status === 'COMPLETED';
  const unit = unitOf(products.find((p) => p.id === form.product_id));
  const outputProduct = products.find((p) => p.id === form.output_product_id) ?? products.find((p) => p.id === form.product_id);
  const countUnit = unitOf(outputProduct);
  // Quantities are stored in the output product's own unit, so that is the unit
  // this figure is compared in.
  const outputChanged = Number(form.output_qty || 0) !== Number(batch.output_qty ?? 0)
    || form.output_product_id !== (batch.output_product_id ?? batch.product_id);
  const reopened = wasCompleted && form.status !== 'COMPLETED';
  // Where the batch says its output is, compared with where it says it is. A batch
  // recorded before the column existed has no warehouse, so this is the edit that
  // gives it one.
  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name ?? 'not set';
  const storageChanged = (form.warehouse_id || null) !== (batch.warehouse_id ?? null);
  const relocated = wasCompleted && storageChanged && form.status === 'COMPLETED';
  // What the operator is about to have happen to the stock this batch already
  // booked, stated plainly before they commit to it.
  const stockNotice = reopened
    ? 'Reopening this batch takes its warehouse stock back out, with a movement recording the release. Completing it again will book the output once, not twice.'
    : relocated
      ? `Saving moves this batch’s stock from ${warehouseName(batch.warehouse_id)} to ${warehouseName(form.warehouse_id)} and records the move as a transfer in each warehouse. The change is refused if that stock has already been sold, reserved or written off, or if the batch is quality approved.`
      : wasCompleted && outputChanged
        ? 'Saving rewrites the output quantity on this batch’s warehouse stock and the movement that booked it. The change is refused if that stock has already been sold, reserved or written off, or if the batch is quality approved.'
        : null;

  async function submit(e) {
    e.preventDefault();
    const batchNumber = form.batch_number.trim();
    setSaving(true);
    const checkpoint = snapshotWrite();
    try {
      // Every edit goes through the database function, not just the ones that touch
      // stock. It refuses the changes that would contradict a sale, a reservation or
      // a quality approval, and it is the only thing that knows how to release or
      // re-point the stock a completed batch already booked.
      const confirmed = await batchesApi.updateBatch(batch.id, {
        batch_number: batchNumber,
        product_id: form.product_id,
        variety_id: form.variety_id || null,
        seed_class_id: form.seed_class_id || null,
        input_qty: Number(form.input_qty),
        output_qty: Number(form.output_qty || 0),
        rejected_qty: Number(form.rejected_qty || 0),
        output_product_id: form.output_product_id || form.product_id,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        quality_status: form.quality_status,
        warehouse_id: form.warehouse_id || null,
        notes: form.notes,
      });
      applyBatchEdit({ ...confirmed, previousStatus: batch.status, previousWarehouseId: batch.warehouse_id ?? null });
      pushToast(`Batch ${batchNumber} updated and saved`, 'success');
      onClose();
    } catch (err) {
      // The function raises for the changes it will not make, and those messages say
      // which batch and why. The local state is put back so the form still matches
      // the database it was refused by.
      restoreWrite(checkpoint);
      pushToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit Batch ${batch.batch_number}`} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Batch number" value={form.batch_number} onChange={set('batch_number')} required />
          <Select label="Status" value={form.status} onChange={set('status')}>
            {PRODUCTION_STATUSES.map((s) => <option key={s} value={s}>{prettyLabel(s)}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Product" value={form.product_id} onChange={set('product_id')} required>
            <option value="">Select product…</option>
            {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select label="Variety" value={form.variety_id} onChange={set('variety_id')}>
            <option value="">—</option>
            {varietyOptions.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
          <Select label="Seed class" value={form.seed_class_id} onChange={set('seed_class_id')}>
            <option value="">—</option>
            {seedClassOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label={`Input quantity (${unit})`} type="number" min="0.01" step="0.01" value={form.input_qty} onChange={set('input_qty')} required />
        </div>
        <OutputProductFields batch={batch} form={form} set={set} products={products} varieties={varieties} seedClasses={seedClasses} plantedProduct={products.find((p) => p.id === form.product_id)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={`Output quantity (${countUnit})`} type="number" min="0" step="0.01" value={form.output_qty} onChange={set('output_qty')} required />
          <Input label={`Rejected quantity (${countUnit})`} type="number" min="0" step="0.01" value={form.rejected_qty} onChange={set('rejected_qty')} />
        </div>
        <WarehouseField warehouses={warehouses} value={form.warehouse_id} onChange={set('warehouse_id')} />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
          <Input label="End date" type="date" value={form.end_date} onChange={set('end_date')} />
          <Select label="Quality status" value={form.quality_status} onChange={set('quality_status')}>
            {QUALITY_STATUSES.map((s) => <option key={s} value={s}>{prettyLabel(s)}</option>)}
          </Select>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set('notes')} />
        {stockNotice && (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            {stockNotice}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}
