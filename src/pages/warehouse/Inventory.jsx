import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Ban, CheckCheck, Clock3, PackageCheck, PackageMinus, RotateCcw, ShieldAlert, Wrench, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatNumber, formatDateTime } from '../../lib/format';
import { availableQty } from '../../lib/calc';

export default function Inventory() {
  const inventory = useStore((s) => s.inventory ?? []);
  const products = useStore((s) => s.products ?? []);
  const warehouses = useStore((s) => s.warehouses ?? []);
  const batches = useStore((s) => s.batches ?? []);
  const movements = useStore((s) => s.movements ?? []);
  const orders = useStore((s) => s.orders ?? []);
  const adjustInventory = useStore((s) => s.adjustInventory);
  const transferStock = useStore((s) => s.transferStock);
  const markDamaged = useStore((s) => s.markDamaged);
  const reserveStock = useStore((s) => s.reserveStock);
  const quarantineStock = useStore((s) => s.quarantineStock);
  const releaseQuarantine = useStore((s) => s.releaseQuarantine);
  const updateProduct = useStore((s) => s.updateProduct);
  const run = useAction();

  const [actionModal, setActionModal] = useState(null); // { type, row }
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [recordGroup, setRecordGroup] = useState(null);
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const groupByProduct = true;

  const productName = (id) => {
    if (id && typeof id === 'object') return id.name ?? '—';
    return products.find((p) => String(p.id) === String(id))?.name
      ?? products.find((p) => p.name === id)?.name
      ?? '—';
  };
  const warehouseName = (id) => warehouses.find((w) => w.id === id)?.name ?? '—';
  const batchNo = (id) => batches.find((b) => b.id === id)?.batch_number ?? 'Bulk';

  const rows = warehouseFilter ? inventory.filter((i) => i.warehouse_id === warehouseFilter) : inventory;
  const productGroups = new Map();
  for (const item of rows) {
    const productId = item.product_id ?? item.product?.id ?? item.product?.name ?? 'unknown';
    const key = `${String(productId)}::${String(item.warehouse_id ?? 'unknown')}`;
    let group = productGroups.get(key);
    if (!group) {
      group = {
        id: `product-warehouse-${key}`,
        product_id: productId,
        warehouse_id: item.warehouse_id,
        quantity: 0,
        available: 0,
        reserved_qty: 0,
        quarantined_qty: 0,
        damaged_qty: 0,
        stock_records: 0,
        records: [],
      };
      productGroups.set(key, group);
    }
    group.quantity += Number(item.quantity) || 0;
    group.available += availableQty(item);
    group.reserved_qty += Number(item.reserved_qty) || 0;
    group.quarantined_qty += Number(item.quarantined_qty) || 0;
    group.damaged_qty += Number(item.damaged_qty) || 0;
    group.stock_records += 1;
    group.records.push(item);
  }
  const productRows = [...productGroups.values()];
  const movementQty = (types) => movements
    .filter((m) => types.includes(m.movement_type))
    .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
  const orderQty = (statuses) => orders
    .filter((o) => statuses.includes(o.status))
    .reduce(
      (sum, o) => sum + (Array.isArray(o.items)
        ? o.items.reduce((itemSum, item) => itemSum + (Number(item?.quantity) || 0), 0)
        : 0),
      0
    );

  const totals = {
    quantity: inventory.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    available: inventory.reduce((s, i) => s + availableQty(i), 0),
    reserved: inventory.reduce((s, i) => s + (Number(i.reserved_qty) || 0), 0),
    quarantined: inventory.reduce((s, i) => s + (Number(i.quarantined_qty) || 0), 0),
    damaged: inventory.reduce((s, i) => s + (Number(i.damaged_qty) || 0), 0),
    stockIn: movementQty(['PRODUCTION', 'RETURN', 'ADJUSTMENT_IN']),
    stockOut: movementQty(['SALE', 'DAMAGE', 'ADJUSTMENT_OUT']),
    sold: movementQty(['SALE']),
    returned: movementQty(['RETURN']),
    delivered: orderQty(['COMPLETED']),
    pending: orderQty(['PENDING', 'CONFIRMED', 'PROCESSING', 'READY']),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Stock position, order commitments and movement totals by product, batch and warehouse"
        actions={<>
          <Button onClick={() => setAddStockOpen(true)}><Plus className="h-4 w-4" /> Add stock</Button>
          <Link to="/app/stock-movements" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:border-green-300 hover:text-green-700">View movement history</Link>
        </>}
      />

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-gray-800">Stock position</h2><p className="text-sm text-gray-500">What entered the warehouse and what is available now.</p></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div id="stock-in"><KPICard icon={ArrowDownToLine} label="Stock In" value={`${formatNumber(totals.stockIn)} kg`} sub="Production, returns & additions" tone="green" /></div>
          <div id="stock-out"><KPICard icon={ArrowUpFromLine} label="Stock Out" value={`${formatNumber(totals.stockOut)} kg`} sub="Sales, damage & removals" tone="red" /></div>
          <div id="current-stock"><KPICard icon={PackageCheck} label="Current Available" value={`${formatNumber(totals.available)} kg`} sub={`${formatNumber(totals.quantity)} kg on hand`} tone="blue" /></div>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-gray-800">Inventory lifecycle</h2><p className="text-sm text-gray-500">Sales, returns and customer-order fulfilment.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div id="sold-inventory"><KPICard icon={PackageMinus} label="Sold Inventory" value={`${formatNumber(totals.sold)} kg`} sub="Issued through sales" tone="purple" /></div>
          <div id="returned"><KPICard icon={RotateCcw} label="Returned" value={`${formatNumber(totals.returned)} kg`} sub="Returned into stock" tone="green" /></div>
          <div id="delivered"><KPICard icon={CheckCheck} label="Delivered" value={`${formatNumber(totals.delivered)} kg`} sub="Completed order quantities" tone="green" /></div>
          <div id="pending-orders"><KPICard icon={Clock3} label="Pending Orders" value={`${formatNumber(totals.pending)} kg`} sub="Open order quantities" tone="amber" /></div>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-gray-800">Stock restrictions</h2><p className="text-sm text-gray-500">Quantities that require attention or cannot currently be issued.</p></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div id="quarantined"><KPICard icon={ShieldAlert} label="Quarantined" value={`${formatNumber(totals.quarantined)} kg`} sub="Not available for issue" tone="purple" /></div>
          <div id="reserved"><KPICard icon={AlertTriangle} label="Reserved" value={`${formatNumber(totals.reserved)} kg`} sub="Committed to orders" tone="amber" /></div>
          <div id="damaged"><KPICard icon={Ban} label="Damaged" value={`${formatNumber(totals.damaged)} kg`} sub="Not available for sale" tone="red" /></div>
        </div>
      </section>

      <DataTable
        columns={groupByProduct ? [
          { key: 'product_id', label: 'Product', render: (i) => <span className="font-semibold text-gray-700">{productName(i.product_id)}</span> },
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => warehouseName(i.warehouse_id) },
          { key: 'quantity', label: 'On Hand Total', render: (i) => <span className="font-semibold text-gray-700">{formatNumber(i.quantity)} kg</span> },
          { key: 'reserved_qty', label: 'Total Reserved', render: (i) => <span className="text-yellow-600">{formatNumber(i.reserved_qty)} kg</span> },
          { key: 'quarantined_qty', label: 'Total Quarantined', render: (i) => <span className="text-purple-600">{formatNumber(i.quarantined_qty)} kg</span> },
          { key: 'available', label: 'Available Total for sale', render: (i) => <span className="font-semibold text-green-600">{formatNumber(i.available)} kg</span> },
          { key: 'stock_records', label: 'Records', render: (i) => <Button size="sm" variant="secondary" onClick={() => setRecordGroup(i)}>View {i.stock_records}</Button> },
        ] : [
          { key: 'product_id', label: 'Product', render: (i) => (
            <div>
              <div className="font-semibold text-gray-700">{productName(i.product_id)}</div>
              <div className="font-mono text-xs text-gray-400">{batchNo(i.batch_id)}</div>
            </div>
          )},
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => <span className="text-gray-600">{warehouseName(i.warehouse_id)}</span> },
          { key: 'quantity', label: 'On Hand', render: (i) => <span className="font-semibold text-gray-700">{formatNumber(i.quantity)} kg</span> },
          { key: 'available', label: 'Current', render: (i) => <span className="font-semibold text-green-600">{formatNumber(availableQty(i))} kg</span> },
          { key: 'reserved_qty', label: 'Reserved', render: (i) => <span className="text-yellow-600">{formatNumber(i.reserved_qty ?? 0)}</span> },
          { key: 'quarantined_qty', label: 'Quarantined', render: (i) => <span className="text-purple-600">{formatNumber(i.quarantined_qty ?? 0)}</span> },
          { key: 'damaged_qty', label: 'Damaged', render: (i) => <span className="text-red-500">{formatNumber(i.damaged_qty ?? 0)}</span> },
          { key: 'stock_status', label: 'Stock Status', sortable: false, render: (i) => {
            const statuses = [];
            if (i.quarantined_qty > 0) statuses.push('Quarantined');
            if (i.reserved_qty > 0) statuses.push('Reserved');
            if (i.damaged_qty > 0) statuses.push('Damaged');
            if (availableQty(i) > 0) statuses.push('Available');
            return <div className="flex flex-wrap gap-1">{statuses.map((status) => <span key={status} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{status}</span>)}</div>;
          } },
          { key: 'updated_at', label: 'Updated', render: (i) => <span className="text-gray-400">{formatDateTime(i.updated_at)}</span> },
          { key: 'actions', label: '', sortable: false, render: (i) => (
            <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary" onClick={() => setActionModal({ type: 'adjust', row: i })}>
                <Wrench className="h-3.5 w-3.5" /> Adjust
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'transfer', row: i })}>Transfer</Button>
              <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'reserve', row: i })}>Reserve</Button>
              <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'quarantine', row: i })}>Quarantine</Button>
              {Number(i.quarantined_qty) > 0 && <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'release-quarantine', row: i })}>Release</Button>}
              <Button size="sm" variant="ghost" onClick={() => setActionModal({ type: 'damage', row: i })}>Damage</Button>
            </div>
          )},
        ]}
        rows={groupByProduct ? productRows : rows}
        searchKeys={[ (r) => productName(r.product_id) ]}
        searchPlaceholder="Search product…"
        filters={
          <FilterSelect
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            placeholder="All warehouses"
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        }
        pageSize={10}
      />

      <ActionModal
        key={`${actionModal?.type ?? 'closed'}-${actionModal?.row?.id ?? 'none'}`}
        action={actionModal}
        onClose={() => setActionModal(null)}
        warehouses={warehouses}
        productPrice={products.find((product) => product.id === actionModal?.row?.product_id)?.selling_price}
        onSubmit={(data) => {
          const { type, row } = actionModal;
          if (type === 'adjust') {
            run(() => {
              adjustInventory({
                product_id: row.product_id,
                batch_id: row.batch_id,
                warehouse_id: row.warehouse_id,
                direction: data.direction,
                quantity: Number(data.quantity),
                notes: data.notes,
              });
              if (data.direction === 'in') updateProduct(row.product_id, { selling_price: Number(data.selling_price) });
            }, data.direction === 'in' ? 'Stock and selling price updated' : 'Inventory adjusted');
          } else if (type === 'transfer') {
            run(() => transferStock({
              product_id: row.product_id,
              batch_id: row.batch_id,
              from_warehouse: row.warehouse_id,
              to_warehouse: data.to_warehouse,
              quantity: Number(data.quantity),
              notes: data.notes,
            }), 'Stock transferred');
          } else if (type === 'damage') {
            run(() => markDamaged({
              product_id: row.product_id,
              batch_id: row.batch_id,
              warehouse_id: row.warehouse_id,
              quantity: Number(data.quantity),
              notes: data.notes,
            }), 'Stock marked as damaged');
          } else if (type === 'reserve') {
            run(() => reserveStock({ product_id: row.product_id, batch_id: row.batch_id, warehouse_id: row.warehouse_id, quantity: Number(data.quantity), notes: data.notes }), 'Stock reserved');
          } else if (type === 'quarantine') {
            run(() => quarantineStock({ product_id: row.product_id, batch_id: row.batch_id, warehouse_id: row.warehouse_id, quantity: Number(data.quantity), notes: data.notes }), 'Stock quarantined');
          } else if (type === 'release-quarantine') {
            run(() => releaseQuarantine({ product_id: row.product_id, batch_id: row.batch_id, warehouse_id: row.warehouse_id, quantity: Number(data.quantity), notes: data.notes }), 'Quarantine released');
          }
          setActionModal(null);
        }}
      />
      <AddStockModal
        key={addStockOpen ? 'add-stock-open' : 'add-stock-closed'}
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        products={products}
        warehouses={warehouses}
        batches={batches}
        onSubmit={(data) => {
          run(() => {
            adjustInventory({
              product_id: data.product_id,
              batch_id: data.batch_id || null,
              warehouse_id: data.warehouse_id,
              direction: 'in',
              quantity: Number(data.quantity),
              notes: data.notes || 'Stock added',
            });
            updateProduct(data.product_id, { selling_price: Number(data.selling_price) });
          }, 'Stock and selling price added');
          setAddStockOpen(false);
        }}
      />
      <Modal open={!!recordGroup} onClose={() => setRecordGroup(null)} title={recordGroup ? `Stock records — ${productName(recordGroup.product_id)}` : 'Stock records'}>
        {recordGroup && <div className="space-y-3">
          <p className="text-sm text-gray-500">{warehouseName(recordGroup.warehouse_id)} · {formatNumber(recordGroup.available)} kg available total</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Stock record</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">On hand</th><th className="px-3 py-2">Available</th><th className="px-3 py-2">Updated</th></tr></thead>
              <tbody>{recordGroup.records.map((record) => <tr key={record.id} className="border-t border-gray-100"><td className="px-3 py-2 font-mono text-gray-500" title={record.id}>{String(record.id).slice(0, 8)}</td><td className="px-3 py-2 font-mono text-gray-600">{batchNo(record.batch_id)}</td><td className="px-3 py-2">{formatNumber(record.quantity)} kg</td><td className="px-3 py-2 font-semibold text-green-700">{formatNumber(availableQty(record))} kg</td><td className="px-3 py-2 text-gray-500">{formatDateTime(record.updated_at)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setRecordGroup(null)}>Close</Button></div>
        </div>}
      </Modal>
    </div>
  );
}

function AddStockModal({ open, onClose, products, warehouses, batches, onSubmit }) {
  const [form, setForm] = useState({ product_id: '', warehouse_id: '', batch_id: '', quantity: '', selling_price: '', notes: '' });
  const selectedProduct = products.find((product) => product.id === form.product_id);
  const productBatches = batches.filter((batch) => batch.product_id === form.product_id);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  if (!open) return null;

  return (
    <Modal open onClose={onClose} title="Add product to inventory">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="space-y-4">
        <Select label="Product" value={form.product_id} onChange={(event) => {
          const product = products.find((item) => item.id === event.target.value);
          setForm((current) => ({ ...current, product_id: event.target.value, batch_id: '', selling_price: product ? String(product.selling_price ?? '') : '' }));
        }} required>
          <option value="">Select product…</option>
          {products.filter((product) => product.status === 'ACTIVE').map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </Select>
        <Select label="Warehouse" value={form.warehouse_id} onChange={set('warehouse_id')} required>
          <option value="">Select warehouse…</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </Select>
        <Select label="Batch" value={form.batch_id} onChange={set('batch_id')}>
          <option value="">Bulk / no batch</option>
          {productBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_number}</option>)}
        </Select>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Quantity (kg)" type="number" min="0.01" step="0.01" value={form.quantity} onChange={set('quantity')} required />
          <Input label="Selling price per kg (RWF)" type="number" min="0" step="0.01" value={form.selling_price} onChange={set('selling_price')} required />
        </div>
        {selectedProduct && <p className="text-xs text-gray-500">This price will update the catalog selling price for {selectedProduct.name}.</p>}
        <Textarea label="Notes (optional)" value={form.notes} onChange={set('notes')} />
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit">Add to inventory</Button></div>
      </form>
    </Modal>
  );
}

function ActionModal({ action, onClose, warehouses, productPrice, onSubmit }) {
  const [form, setForm] = useState({ quantity: '', notes: '', direction: 'in', to_warehouse: '', selling_price: productPrice ?? '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (!action) return null;
  const titles = { adjust: 'Adjust stock', transfer: 'Transfer stock', damage: 'Mark damaged', reserve: 'Reserve stock', quarantine: 'Quarantine stock', 'release-quarantine': 'Release quarantine' };

  return (
    <Modal open={!!action} onClose={onClose} title={titles[action.type]}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        {action.type === 'adjust' && (
          <Select label="Direction" value={form.direction} onChange={set('direction')}>
            <option value="in">Add stock (+)</option>
            <option value="out">Remove stock (−)</option>
          </Select>
        )}
        {action.type === 'transfer' && (
          <Select label="Destination warehouse" value={form.to_warehouse} onChange={set('to_warehouse')} required>
            <option value="">Select warehouse…</option>
            {warehouses.filter((w) => w.id !== action.row.warehouse_id).map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        )}
        {action.type === 'adjust' && form.direction === 'in' && (
          <Input label="Selling price per kg (RWF)" type="number" min="0" step="0.01" value={form.selling_price} onChange={set('selling_price')} required />
        )}
        <Input label="Quantity (kg)" type="number" min="1" max={action.type === 'release-quarantine' ? action.row.quarantined_qty : undefined} value={form.quantity} onChange={set('quantity')} required />
        <Textarea label="Notes / reason" value={form.notes} onChange={set('notes')} required={['adjust', 'quarantine', 'release-quarantine'].includes(action.type)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Confirm</Button>
        </div>
      </form>
    </Modal>
  );
}
