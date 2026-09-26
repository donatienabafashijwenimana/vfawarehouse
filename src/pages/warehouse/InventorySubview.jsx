import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CheckCheck, Clock3, Package, RotateCcw, ShieldAlert, Warehouse as WarehouseIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatDateTime, formatNumber } from '../../lib/format';
import { availableQty } from '../../lib/calc';
import { useAction } from '../../hooks/useAction';

const MOVEMENT_VIEWS = {
  'stock-in': { title: 'Stock In', subtitle: 'All quantities received into inventory', types: ['PRODUCTION', 'RETURN', 'ADJUSTMENT_IN'], icon: ArrowDownToLine, tone: 'green' },
  'stock-out': { title: 'Stock Out', subtitle: 'All quantities issued or removed from inventory', types: ['SALE', 'DAMAGE', 'ADJUSTMENT_OUT'], icon: ArrowUpFromLine, tone: 'red' },
  sold: { title: 'Sold Inventory', subtitle: 'Inventory issued through completed sales', types: ['SALE'], icon: Package, tone: 'purple' },
  returned: { title: 'Returned Inventory', subtitle: 'Inventory returned into stock', types: ['RETURN'], icon: RotateCcw, tone: 'green' },
  transferred: { title: 'Transferred Inventory', subtitle: 'Stock moved between warehouses — internal, not a receipt or an issue', types: ['TRANSFER'], icon: ArrowLeftRight, tone: 'blue' },
};

export default function InventorySubview({ view }) {
  const inventory = useStore((s) => s.inventory ?? []);
  const products = useStore((s) => s.products ?? []);
  const warehouses = useStore((s) => s.warehouses ?? []);
  const movements = useStore((s) => s.movements ?? []);
  const orders = useStore((s) => s.orders ?? []);
  const batches = useStore((s) => s.batches ?? []);
  const reserveStock = useStore((s) => s.reserveStock);
  const releaseReservedStock = useStore((s) => s.releaseReservedStock);
  const releaseQuarantine = useStore((s) => s.releaseQuarantine);
  const quarantineStock = useStore((s) => s.quarantineStock);
  const markDamaged = useStore((s) => s.markDamaged);
  const run = useAction();
  const [placement, setPlacement] = useState(null);
  const [recordGroup, setRecordGroup] = useState(null);
  const [restoreRow, setRestoreRow] = useState(null);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const groupCurrentStock = true;

  const productName = (id) => products.find((p) => p.id === id)?.name ?? '—';
  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name ?? '—';
  const batchName = (id) => batches.find((b) => b.id === id)?.batch_number ?? 'Bulk';
  const restorableReservedQty = (row) => {
    const orderReserved = orders
      .filter((order) => ['CONFIRMED', 'PROCESSING', 'READY'].includes(order.status))
      .flatMap((order) => order.items ?? [])
      .filter((item) => item.product_id === row.product_id && (item.batch_id ?? null) === (row.batch_id ?? null) && item.warehouse_id === row.warehouse_id)
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return Math.max(0, Number(row.reserved_qty) - orderReserved);
  };

  const movementConfig = MOVEMENT_VIEWS[view];
  const movementRows = movementConfig
    ? movements.filter((m) =>
        movementConfig.types.includes(m.movement_type) &&
        (!warehouseFilter || m.warehouse_id === warehouseFilter)
      )
    : [];
  const stateRows = useMemo(() => {
    const scoped = warehouseFilter
      ? inventory.filter((i) => i.warehouse_id === warehouseFilter)
      : inventory;
    if (view === 'current-stock') return scoped.filter((i) => availableQty(i) > 0);
    if (view === 'quarantined') return scoped.filter((i) => Number(i.quarantined_qty) > 0);
    if (view === 'reserved') return scoped.filter((i) => Number(i.reserved_qty) > 0);
    if (view === 'damaged') return scoped.filter((i) => Number(i.damaged_qty) > 0);
    return scoped;
  }, [view, inventory, warehouseFilter]);
  const groupedCurrentStock = useMemo(() => {
    const groups = new Map();
    for (const row of stateRows) {
      const productId = row.product_id;
      const key = `${String(productId ?? 'unknown')}::${String(row.warehouse_id ?? 'unknown')}`;
      let group = groups.get(key);
      if (!group) {
        group = { id: `product-warehouse-${key}`, product_id: productId, warehouse_id: row.warehouse_id, available: 0, on_hand: 0, reserved_qty: 0, quarantined_qty: 0, stock_records: 0, records: [] };
        groups.set(key, group);
      }
      group.available += availableQty(row);
      group.on_hand += Number(row.quantity) || 0;
      group.reserved_qty += Number(row.reserved_qty) || 0;
      group.quarantined_qty += Number(row.quarantined_qty) || 0;
      group.stock_records += 1;
      group.records.push(row);
    }
    return [...groups.values()];
  }, [stateRows]);
  const orderRows = view === 'delivered'
    ? orders.filter((o) => o.status === 'COMPLETED')
    : orders.filter((o) => ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY'].includes(o.status));

  // One warehouse selector, shared by the movement views and the stock-state
  // views so every figure on the page is scoped to the warehouse being shown.
  const warehouseFilterSelect = (
    <FilterSelect
      value={warehouseFilter}
      onChange={setWarehouseFilter}
      placeholder="All warehouses"
      options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
    />
  );

  if (movementConfig) {
    const total = movementRows.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
    const Icon = movementConfig.icon;
    return (
      <div className="space-y-6">
        <PageHeader title={movementConfig.title} subtitle={movementConfig.subtitle} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KPICard icon={Icon} label="Total Quantity" value={`${formatNumber(total)} kg`} tone={movementConfig.tone} />
          <KPICard icon={Package} label="Transactions" value={movementRows.length} tone="blue" />
          <KPICard icon={WarehouseIcon} label="Warehouses" value={new Set(movementRows.map((m) => m.warehouse_id)).size} tone="purple" />
        </div>
        <DataTable
          columns={movementColumns(productName, warehouseName, batchName)}
          rows={movementRows}
          searchKeys={['notes', (m) => productName(m.product_id)]}
          searchPlaceholder="Search product or movement notes…"
          filters={warehouseFilterSelect}
          pageSize={12}
          emptyHint={`No ${movementConfig.title.toLowerCase()} movements recorded yet.`}
        />
      </div>
    );
  }

  if (view === 'delivered' || view === 'pending') {
    const delivered = view === 'delivered';
    const total = orderRows.reduce((sum, o) => sum + orderQuantity(o), 0);
    return (
      <div className="space-y-6">
        <PageHeader title={delivered ? 'Delivered Quantities' : 'Pending Order Quantities'} subtitle={delivered ? 'Quantities on completed customer orders' : 'Quantities committed to open customer orders'} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KPICard icon={delivered ? CheckCheck : Clock3} label="Total Quantity" value={`${formatNumber(total)} kg`} tone={delivered ? 'green' : 'amber'} />
          <KPICard icon={Package} label="Orders" value={orderRows.length} tone="blue" />
          <KPICard icon={WarehouseIcon} label="Average per Order" value={`${formatNumber(orderRows.length ? total / orderRows.length : 0)} kg`} tone="purple" />
        </div>
        <DataTable
          columns={[
            { key: 'order_number', label: 'Order' },
            { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} /> },
            { key: 'quantity', label: 'Quantity', render: (o) => `${formatNumber(orderQuantity(o))} kg` },
            { key: 'created_at', label: 'Date', render: (o) => formatDateTime(o.created_at) },
            { key: 'notes', label: 'Notes' },
          ]}
          rows={orderRows.map((o) => ({ ...o, quantity: orderQuantity(o) }))}
          searchKeys={['order_number', 'status', 'notes']}
          searchPlaceholder="Search order…"
          pageSize={12}
          emptyHint={`No ${delivered ? 'delivered' : 'pending'} order quantities found.`}
        />
      </div>
    );
  }

  const stateConfig = {
    'current-stock': { title: 'Current Available Stock', subtitle: 'Stock currently available for issue or sale', icon: Package, tone: 'green', value: (i) => availableQty(i), label: 'Available' },
    quarantined: { title: 'Quarantined Stock', subtitle: 'Stock held back from issue pending inspection', icon: ShieldAlert, tone: 'purple', value: (i) => i.quarantined_qty, label: 'Quarantined' },
    reserved: { title: 'Reserved Stock', subtitle: 'Stock committed to customer orders', icon: Clock3, tone: 'amber', value: (i) => i.reserved_qty, label: 'Reserved' },
    damaged: { title: 'Damaged Stock', subtitle: 'Stock recorded as damaged and unavailable for sale', icon: ShieldAlert, tone: 'red', value: (i) => i.damaged_qty, label: 'Damaged' },
  }[view] ?? { title: 'Inventory', subtitle: 'Inventory by product, batch and warehouse', icon: Package, tone: 'blue', value: (i) => i.quantity, label: 'Quantity' };
  const total = stateRows.reduce((sum, i) => sum + (Number(stateConfig.value(i)) || 0), 0);
  const placementType = {
    quarantined: 'quarantine',
    reserved: 'reserve',
    damaged: 'damage',
  }[view];
  // Placing stock into a condition draws from anything still available in the
  // selected warehouse, not only rows already sitting in that condition.
  const placeableRows = (warehouseFilter
    ? inventory.filter((i) => i.warehouse_id === warehouseFilter)
    : inventory
  ).filter((i) => availableQty(i) > 0);
  const placeStock = (data) => {
    const row = inventory.find((item) => item.id === data.inventory_id);
    if (!row) throw new Error('Select an inventory item');
    const payload = {
      product_id: row.product_id,
      batch_id: row.batch_id,
      warehouse_id: row.warehouse_id,
      quantity: Number(data.quantity),
      notes: data.notes,
    };
    const actions = {
      reserve: [reserveStock, 'Stock placed in reserved stock'],
      quarantine: [quarantineStock, 'Stock placed in quarantined stock'],
      damage: [markDamaged, 'Stock placed in damaged stock'],
    };
    const [action, message] = actions[placementType];
    run(() => action(payload), message);
    setPlacement(null);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title={stateConfig.title}
        subtitle={stateConfig.subtitle}
        actions={placementType ? <Button onClick={() => setPlacement(placementType)} disabled={!placeableRows.length}>Place item in {stateConfig.label.toLowerCase()}</Button> : undefined}
      />
      <KPICard icon={stateConfig.icon} label={stateConfig.label} value={`${formatNumber(total)} kg`} tone={stateConfig.tone} />
      <DataTable
        columns={view === 'current-stock' && groupCurrentStock ? [
          { key: 'product_id', label: 'Product', render: (i) => <span className="font-semibold text-gray-700">{productName(i.product_id)}</span> },
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => warehouseName(i.warehouse_id) },
          { key: 'on_hand', label: 'On Hand Total', render: (i) => `${formatNumber(i.on_hand)} kg` },
          { key: 'reserved_qty', label: 'Total Reserved', render: (i) => `${formatNumber(i.reserved_qty)} kg` },
          { key: 'quarantined_qty', label: 'Total Quarantined', render: (i) => `${formatNumber(i.quarantined_qty)} kg` },
          { key: 'available', label: 'Available Total for sale', render: (i) => <span className="font-semibold text-green-700">{formatNumber(i.available)} kg</span> },
          { key: 'stock_records', label: 'Records', render: (i) => <Button size="sm" variant="secondary" onClick={() => setRecordGroup(i)}>View {i.stock_records}</Button> },
        ] : [
          { key: 'product_id', label: 'Product', render: (i) => <div><div className="font-semibold text-gray-700">{productName(i.product_id)}</div><div className="font-mono text-xs text-gray-400">{batchName(i.batch_id)}</div></div> },
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => warehouseName(i.warehouse_id) },
          { key: 'quantity', label: 'On Hand', render: (i) => `${formatNumber(i.quantity)} kg` },
          { key: 'state_quantity', label: stateConfig.label, render: (i) => <span className="font-semibold text-green-700">{formatNumber(stateConfig.value(i))} kg</span> },
          { key: 'updated_at', label: 'Updated', render: (i) => formatDateTime(i.updated_at) },
          ...(['reserved', 'quarantined'].includes(view) ? [{ key: 'restore', label: '', sortable: false, render: (i) => <Button size="sm" variant="secondary" disabled={view === 'reserved' && restorableReservedQty(i) <= 0} onClick={() => setRestoreRow(i)}>Restore to available</Button> }] : []),
        ]}
        rows={view === 'current-stock' && groupCurrentStock ? groupedCurrentStock : stateRows}
        searchKeys={[(i) => productName(i.product_id), (i) => warehouseName(i.warehouse_id)]}
        searchPlaceholder="Search product or warehouse…"
        filters={warehouseFilterSelect}
        pageSize={12}
        emptyHint="No matching inventory records found."
      />
      <StockPlacementModal
        key={placement ?? 'closed'}
        type={placement}
        rows={placeableRows}
        productName={productName}
        warehouseName={warehouseName}
        batchName={batchName}
        onClose={() => setPlacement(null)}
        onSubmit={placeStock}
      />
      <StockRecordsModal
        group={recordGroup}
        productName={productName}
        warehouseName={warehouseName}
        batchName={batchName}
        onClose={() => setRecordGroup(null)}
      />
      <RestoreStockModal
        row={restoreRow}
        type={view === 'quarantined' ? 'quarantined' : 'reserved'}
        maxQuantity={restoreRow && view === 'reserved' ? restorableReservedQty(restoreRow) : Number(restoreRow?.quarantined_qty) || 0}
        onClose={() => setRestoreRow(null)}
        onSubmit={(data) => {
          const action = view === 'quarantined' ? releaseQuarantine : releaseReservedStock;
          run(() => action({
            product_id: restoreRow.product_id,
            batch_id: restoreRow.batch_id,
            warehouse_id: restoreRow.warehouse_id,
            quantity: Number(data.quantity),
            notes: data.notes,
          }), `${view === 'quarantined' ? 'Quarantined' : 'Reserved'} stock restored to available`);
          setRestoreRow(null);
        }}
      />
    </div>
  );
}

function StockPlacementModal({ type, rows, productName, warehouseName, batchName, onClose, onSubmit }) {
  const [form, setForm] = useState({ inventory_id: '', quantity: '', notes: '' });
  const selected = rows.find((row) => row.id === form.inventory_id);
  const label = { reserve: 'Reserved', quarantine: 'Quarantined', damage: 'Damaged' }[type];

  if (!type) return null;
  return (
    <Modal open onClose={onClose} title={`Place item in ${label} Stock`}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
        <Select label="Available inventory item" value={form.inventory_id} onChange={(event) => setForm((current) => ({ ...current, inventory_id: event.target.value, quantity: '' }))} required>
          <option value="">Select an item…</option>
          {rows.map((row) => <option key={row.id} value={row.id}>{productName(row.product_id)} · {batchName(row.batch_id)} · {warehouseName(row.warehouse_id)} ({formatNumber(availableQty(row))} kg available)</option>)}
        </Select>
        <Input label="Quantity (kg)" type="number" min="0.01" step="0.01" max={selected ? availableQty(selected) : undefined} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
        <Textarea label="Notes / reason" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} required={type === 'quarantine'} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Place in {label}</Button>
        </div>
      </form>
    </Modal>
  );
}

function StockRecordsModal({ group, productName, warehouseName, batchName, onClose }) {
  if (!group) return null;
  return (
    <Modal open onClose={onClose} title={`Stock records — ${productName(group.product_id)}`}>
      <div className="space-y-3">
        <p className="text-sm text-gray-500">{warehouseName(group.warehouse_id)} · {formatNumber(group.available)} kg available total</p>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Stock record</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">On hand</th><th className="px-3 py-2">Available</th><th className="px-3 py-2">Updated</th></tr></thead>
            <tbody>{group.records.map((record) => <tr key={record.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-gray-500" title={record.id}>{String(record.id).slice(0, 8)}</td>
              <td className="px-3 py-2 font-mono text-gray-600">{batchName(record.batch_id)}</td>
              <td className="px-3 py-2">{formatNumber(record.quantity)} kg</td>
              <td className="px-3 py-2 font-semibold text-green-700">{formatNumber(availableQty(record))} kg</td>
              <td className="px-3 py-2 text-gray-500">{formatDateTime(record.updated_at)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  );
}

function RestoreStockModal({ row, type, maxQuantity, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  if (!row) return null;
  const label = type === 'quarantined' ? 'quarantined_qty' : 'reserved_qty';
  const title = type === 'quarantined' ? 'quarantined' : 'reserved';
  return (
    <Modal open onClose={onClose} title={`Restore ${title} stock`}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit({ quantity, notes }); }} className="space-y-4">
        <p className="text-sm text-gray-600">Move stock back to available for sale. Up to {formatNumber(maxQuantity)} kg can be restored from this batch.</p>
        <Input label="Quantity to restore (kg)" type="number" min="0.01" step="0.01" max={maxQuantity} value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
        <Textarea label="Notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Restore to available</Button></div>
      </form>
    </Modal>
  );
}

function orderQuantity(order) {
  return Array.isArray(order?.items) ? order.items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0) : 0;
}

function movementColumns(productName, warehouseName, batchName) {
  return [
    { key: 'created_at', label: 'Date', render: (m) => formatDateTime(m.created_at) },
    { key: 'product_id', label: 'Product', render: (m) => <div><div className="font-medium text-gray-700">{productName(m.product_id)}</div><div className="font-mono text-xs text-gray-400">{batchName(m.batch_id)}</div></div> },
    { key: 'movement_type', label: 'Type', render: (m) => <StatusBadge status={m.movement_type} /> },
    { key: 'quantity', label: 'Quantity', render: (m) => `${formatNumber(m.quantity)} kg` },
    { key: 'warehouse_id', label: 'Warehouse', render: (m) => warehouseName(m.warehouse_id) },
    { key: 'notes', label: 'Notes' },
  ];
}
