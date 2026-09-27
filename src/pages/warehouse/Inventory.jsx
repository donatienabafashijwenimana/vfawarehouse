import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Ban, CheckCheck, Clock3, PackageCheck, PackageMinus, RotateCcw, ShieldAlert, Wrench, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, Textarea } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatNumber, formatDateTime } from '../../lib/format';
import { availableQty } from '../../lib/calc';
import { groupByUnit, unitLookup, unitOf } from '../../lib/units';
import { productDetailLookup, productDetailLabel } from '../../lib/productDetail';
import { ProductCell } from '../../components/ui/ProductCell';
import { GroupedTotal, GroupedTotalText } from '../../components/ui/UnitTotals';

export default function Inventory() {
  const inventory = useStore((s) => s.inventory ?? []);
  const products = useStore((s) => s.products ?? []);
  const varieties = useStore((s) => s.varieties ?? []);
  const seedClasses = useStore((s) => s.seedClasses ?? []);
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

  const unitForProduct = (productId) => unitOf(products.find((p) => p.id === productId));
  const productDetail = productDetailLookup(products, { varieties, seedClasses });
  const productName = (id) => {
    if (id && typeof id === 'object') return productDetail(id).name || '—';
    return productDetail(id).name
      || products.find((p) => p.name === id)?.name
      || '—';
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
  // Every headline figure below is scoped to the same rows the table shows, so a
  // warehouse filter can never leave the cards reporting stock the list omits.
  const filteredMovements = warehouseFilter
    ? movements.filter((m) => m.warehouse_id === warehouseFilter)
    : movements;
  const filteredOrders = warehouseFilter
    ? orders.filter((o) =>
        (Array.isArray(o.items) ? o.items : []).some(
          (item) => !item.warehouse_id || item.warehouse_id === warehouseFilter
        )
      )
    : orders;
  // A farmer's products are counted in whatever unit suits each one, so a single
  // figure across the whole warehouse would add kilograms to bags. Every headline
  // number below is therefore grouped by the unit it is counted in and shown one
  // line per unit. The arithmetic inside a group is unchanged.
  const unitForRow = unitLookup(products);
  const stockTotals = (totalOf) => groupByUnit(rows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf });
  const movementTotals = (types) => groupByUnit(
    filteredMovements.filter((m) => types.includes(m.movement_type)),
    { unitOfRow: (m) => unitForRow(m.product_id), totalOf: (m) => Number(m.quantity) || 0 }
  );
  const orderTotals = (statuses) => groupByUnit(
    filteredOrders
      .filter((o) => statuses.includes(o.status))
      .flatMap((o) => (Array.isArray(o.items) ? o.items : [])),
    { unitOfRow: (item) => unitForRow(item.product_id), totalOf: (item) => Number(item.quantity) || 0 }
  );

  const totals = {
    quantity: stockTotals((i) => Number(i.quantity) || 0),
    available: stockTotals(availableQty),
    reserved: stockTotals((i) => Number(i.reserved_qty) || 0),
    quarantined: stockTotals((i) => Number(i.quarantined_qty) || 0),
    damaged: stockTotals((i) => Number(i.damaged_qty) || 0),
    stockIn: movementTotals(['PRODUCTION', 'RETURN', 'ADJUSTMENT_IN']),
    stockOut: movementTotals(['SALE', 'DAMAGE', 'ADJUSTMENT_OUT']),
    sold: movementTotals(['SALE']),
    returned: movementTotals(['RETURN']),
    transferred: movementTotals(['TRANSFER']),
    delivered: orderTotals(['COMPLETED']),
    pending: orderTotals(['PENDING', 'CONFIRMED', 'PROCESSING', 'READY']),
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
          <div id="stock-in"><KPICard icon={ArrowDownToLine} label="Stock In" value={<GroupedTotal groups={totals.stockIn} />} sub="Production, returns & additions" tone="green" /></div>
          <div id="stock-out"><KPICard icon={ArrowUpFromLine} label="Stock Out" value={<GroupedTotal groups={totals.stockOut} />} sub="Sales, damage & removals" tone="red" /></div>
          <div id="current-stock"><KPICard icon={PackageCheck} label="Current Available" value={<GroupedTotal groups={totals.available} />} sub={`${GroupedTotalText({ groups: totals.quantity })} on hand`} tone="blue" /></div>
        </div>
        {warehouseFilter && (
          <p className="text-xs text-gray-500">
            Figures above cover {warehouseName(warehouseFilter)} only. Warehouse-to-warehouse transfers are internal moves, so they are excluded from Stock In and Stock Out.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-gray-800">Inventory lifecycle</h2><p className="text-sm text-gray-500">Sales, returns and customer-order fulfilment.</p></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div id="sold-inventory"><KPICard icon={PackageMinus} label="Sold Inventory" value={<GroupedTotal groups={totals.sold} />} sub="Issued through sales" tone="purple" /></div>
          <div id="returned"><KPICard icon={RotateCcw} label="Returned" value={<GroupedTotal groups={totals.returned} />} sub="Returned into stock" tone="green" /></div>
          <div id="transferred"><KPICard icon={ArrowLeftRight} label="Transferred" value={<GroupedTotal groups={totals.transferred} />} sub="Moved between warehouses" tone="blue" /></div>
          <div id="delivered"><KPICard icon={CheckCheck} label="Delivered" value={<GroupedTotal groups={totals.delivered} />} sub="Completed order quantities" tone="green" /></div>
          <div id="pending-orders"><KPICard icon={Clock3} label="Pending Orders" value={<GroupedTotal groups={totals.pending} />} sub="Open order quantities" tone="amber" /></div>
        </div>
      </section>

      <section className="space-y-3">
        <div><h2 className="text-base font-bold text-gray-800">Stock restrictions</h2><p className="text-sm text-gray-500">Quantities that require attention or cannot currently be issued.</p></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div id="quarantined"><KPICard icon={ShieldAlert} label="Quarantined" value={<GroupedTotal groups={totals.quarantined} />} sub="Not available for issue" tone="purple" /></div>
          <div id="reserved"><KPICard icon={AlertTriangle} label="Reserved" value={<GroupedTotal groups={totals.reserved} />} sub="Committed to orders" tone="amber" /></div>
          <div id="damaged"><KPICard icon={Ban} label="Damaged" value={<GroupedTotal groups={totals.damaged} />} sub="Not available for sale" tone="red" /></div>
        </div>
      </section>

      <DataTable
        columns={groupByProduct ? [
          { key: 'product_id', label: 'Product', render: (i) => <ProductCell detail={productDetail(i.product_id)} /> },
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => warehouseName(i.warehouse_id) },
          { key: 'quantity', label: 'On Hand Total', render: (i) => <span className="font-semibold text-gray-700">{formatNumber(i.quantity)} {unitForProduct(i.product_id)}</span> },
          { key: 'reserved_qty', label: 'Total Reserved', render: (i) => <span className="text-yellow-600">{formatNumber(i.reserved_qty)} {unitForProduct(i.product_id)}</span> },
          { key: 'quarantined_qty', label: 'Total Quarantined', render: (i) => <span className="text-purple-600">{formatNumber(i.quarantined_qty)} {unitForProduct(i.product_id)}</span> },
          { key: 'available', label: 'Available Total for sale', render: (i) => <span className="font-semibold text-green-600">{formatNumber(i.available)} {unitForProduct(i.product_id)}</span> },
          { key: 'stock_records', label: 'Records', render: (i) => <Button size="sm" variant="secondary" onClick={() => setRecordGroup(i)}>View {i.stock_records}</Button> },
        ] : [
          { key: 'product_id', label: 'Product', render: (i) => (
            <ProductCell
              detail={productDetail(i.product_id)}
              sub={<div className="font-mono text-xs text-gray-400">{batchNo(i.batch_id)}</div>}
            />
          )},
          { key: 'warehouse_id', label: 'Warehouse', render: (i) => <span className="text-gray-600">{warehouseName(i.warehouse_id)}</span> },
          { key: 'quantity', label: 'On Hand', render: (i) => <span className="font-semibold text-gray-700">{formatNumber(i.quantity)} {unitForProduct(i.product_id)}</span> },
          { key: 'available', label: 'Current', render: (i) => <span className="font-semibold text-green-600">{formatNumber(availableQty(i))} {unitForProduct(i.product_id)}</span> },
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
        searchKeys={[ (r) => productDetail(r.product_id).text ]}
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
        productDetail={productDetail}
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
          <p className="text-sm text-gray-500">{warehouseName(recordGroup.warehouse_id)} · {formatNumber(recordGroup.available)} {unitForProduct(recordGroup.product_id)} available total</p>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Stock record</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">On hand</th><th className="px-3 py-2">Available</th><th className="px-3 py-2">Updated</th></tr></thead>
              <tbody>{recordGroup.records.map((record) => <tr key={record.id} className="border-t border-gray-100"><td className="px-3 py-2 font-mono text-gray-500" title={record.id}>{String(record.id).slice(0, 8)}</td><td className="px-3 py-2 font-mono text-gray-600">{batchNo(record.batch_id)}</td><td className="px-3 py-2">{formatNumber(record.quantity)} {unitForProduct(record.product_id)}</td><td className="px-3 py-2 font-semibold text-green-700">{formatNumber(availableQty(record))} {unitForProduct(record.product_id)}</td><td className="px-3 py-2 text-gray-500">{formatDateTime(record.updated_at)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setRecordGroup(null)}>Close</Button></div>
        </div>}
      </Modal>
    </div>
  );
}

function AddStockModal({ open, onClose, products, productDetail, warehouses, batches, onSubmit }) {
  const [form, setForm] = useState({ product_id: '', warehouse_id: '', batch_id: '', quantity: '', selling_price: '', notes: '' });
  const selectedProduct = products.find((product) => product.id === form.product_id);
  // A batch's stock is booked against the product it *produced*, which is not always
  // the one that was planted, so a completed batch belongs under its output product
  // too — otherwise its stock cannot be reached from this form at all.
  const productBatches = batches.filter((batch) => batch.product_id === form.product_id || (batch.output_product_id && batch.output_product_id === form.product_id));
  const selectedBatch = batches.find((batch) => batch.id === form.batch_id);
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
          {products.filter((product) => product.status === 'ACTIVE').map((product) => <option key={product.id} value={product.id}>{productDetailLabel(productDetail(product.id))}</option>)}
        </Select>
        <Select label="Warehouse" value={form.warehouse_id} onChange={set('warehouse_id')} required>
          <option value="">Select warehouse…</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </Select>
        {selectedBatch?.warehouse_id && form.warehouse_id === selectedBatch.warehouse_id && <p className="text-xs text-gray-500">That is the warehouse batch {selectedBatch.batch_number} is stored in. Change it here only if you are deliberately stocking it somewhere else.</p>}
        <Select label="Batch" value={form.batch_id} onChange={(event) => {
          const batch = batches.find((item) => item.id === event.target.value);
          setForm((current) => ({ ...current, batch_id: event.target.value, warehouse_id: batch?.warehouse_id || current.warehouse_id }));
        }}>
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
