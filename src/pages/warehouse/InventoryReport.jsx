import { useMemo, useState } from 'react';
import { Boxes, PackageCheck, ShieldAlert, Warehouse as WarehouseIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatNumber } from '../../lib/format';
import { availableQty } from '../../lib/calc';

export default function InventoryReport() {
  const inventory = useStore((state) => state.inventory ?? []);
  const products = useStore((state) => state.products ?? []);
  const warehouses = useStore((state) => state.warehouses ?? []);
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const productName = (id) => products.find((product) => product.id === id)?.name ?? '—';
  const warehouseName = (id) => warehouses.find((warehouse) => warehouse.id === id)?.name ?? '—';
  const filteredInventory = warehouseFilter
    ? inventory.filter((row) => row.warehouse_id === warehouseFilter)
    : inventory;

  const reportRows = useMemo(() => {
    const groups = new Map();
    for (const row of filteredInventory) {
      const key = `${row.product_id}::${row.warehouse_id}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: `report-${key}`,
          product_id: row.product_id,
          warehouse_id: row.warehouse_id,
          on_hand: 0,
          reserved: 0,
          quarantined: 0,
          damaged: 0,
          available: 0,
          records: 0,
        };
        groups.set(key, group);
      }
      group.on_hand += Number(row.quantity) || 0;
      group.reserved += Number(row.reserved_qty) || 0;
      group.quarantined += Number(row.quarantined_qty) || 0;
      group.damaged += Number(row.damaged_qty) || 0;
      group.available += availableQty(row);
      group.records += 1;
    }
    return [...groups.values()];
  }, [filteredInventory]);

  const totals = reportRows.reduce((summary, row) => ({
    on_hand: summary.on_hand + row.on_hand,
    reserved: summary.reserved + row.reserved,
    quarantined: summary.quarantined + row.quarantined,
    available: summary.available + row.available,
  }), { on_hand: 0, reserved: 0, quarantined: 0, available: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Report" subtitle="Stock totals grouped by product and warehouse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard icon={Boxes} label="On Hand" value={`${formatNumber(totals.on_hand)} kg`} tone="blue" />
        <KPICard icon={PackageCheck} label="Available for Sale" value={`${formatNumber(totals.available)} kg`} tone="green" />
        <KPICard icon={WarehouseIcon} label="Reserved" value={`${formatNumber(totals.reserved)} kg`} tone="amber" />
        <KPICard icon={ShieldAlert} label="Quarantined" value={`${formatNumber(totals.quarantined)} kg`} tone="purple" />
      </div>
      <DataTable
        columns={[
          { key: 'product_id', label: 'Product', render: (row) => <span className="font-semibold text-gray-700">{productName(row.product_id)}</span> },
          { key: 'warehouse_id', label: 'Warehouse', render: (row) => warehouseName(row.warehouse_id) },
          { key: 'on_hand', label: 'On Hand Total', render: (row) => `${formatNumber(row.on_hand)} kg` },
          { key: 'reserved', label: 'Total Reserved', render: (row) => `${formatNumber(row.reserved)} kg` },
          { key: 'quarantined', label: 'Total Quarantined', render: (row) => `${formatNumber(row.quarantined)} kg` },
          { key: 'damaged', label: 'Total Damaged', render: (row) => `${formatNumber(row.damaged)} kg` },
          { key: 'available', label: 'Available Total for Sale', render: (row) => <span className="font-semibold text-green-700">{formatNumber(row.available)} kg</span> },
          { key: 'records', label: 'Stock Records' },
        ]}
        rows={reportRows}
        searchKeys={[(row) => productName(row.product_id), (row) => warehouseName(row.warehouse_id)]}
        searchPlaceholder="Search product or warehouse…"
        filters={<FilterSelect value={warehouseFilter} onChange={setWarehouseFilter} placeholder="All warehouses" options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} />}
        pageSize={12}
        emptyHint="No inventory records match this report."
      />
    </div>
  );
}
