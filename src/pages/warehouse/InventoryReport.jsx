import { useMemo, useState } from 'react';
import { Boxes, PackageCheck, ShieldAlert, Warehouse as WarehouseIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { PageHeader, KPICard } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { formatNumber } from '../../lib/format';
import { availableQty } from '../../lib/calc';
import { groupByUnit, unitLookup } from '../../lib/units';
import { productDetailLookup } from '../../lib/productDetail';
import { ProductCell } from '../../components/ui/ProductCell';
import { GroupedTotal } from '../../components/ui/UnitTotals';

export default function InventoryReport() {
  const inventory = useStore((state) => state.inventory ?? []);
  const products = useStore((state) => state.products ?? []);
  const varieties = useStore((state) => state.varieties ?? []);
  const seedClasses = useStore((state) => state.seedClasses ?? []);
  const warehouses = useStore((state) => state.warehouses ?? []);
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const productDetail = productDetailLookup(products, { varieties, seedClasses });
  const productName = (id) => productDetail(id).name || '—';
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

  // A report total across every product would add kilograms to bags, so each
  // figure is grouped by unit and reported one line per unit. damaged is included
  // here for the same reason it is accumulated per group below.
  const unitForRow = unitLookup(products);
  const totals = {
    on_hand: groupByUnit(reportRows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf: (r) => r.on_hand }),
    reserved: groupByUnit(reportRows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf: (r) => r.reserved }),
    quarantined: groupByUnit(reportRows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf: (r) => r.quarantined }),
    damaged: groupByUnit(reportRows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf: (r) => r.damaged }),
    available: groupByUnit(reportRows, { unitOfRow: (r) => unitForRow(r.product_id), totalOf: (r) => r.available }),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Report" subtitle="Stock totals grouped by product and warehouse" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard icon={Boxes} label="On Hand" value={<GroupedTotal groups={totals.on_hand} />} tone="blue" />
        <KPICard icon={PackageCheck} label="Available for Sale" value={<GroupedTotal groups={totals.available} />} tone="green" />
        <KPICard icon={WarehouseIcon} label="Reserved" value={<GroupedTotal groups={totals.reserved} />} tone="amber" />
        <KPICard icon={ShieldAlert} label="Quarantined" value={<GroupedTotal groups={totals.quarantined} />} tone="purple" />
      </div>
      <DataTable
        columns={[
          { key: 'product_id', label: 'Product', render: (row) => <ProductCell detail={productDetail(row.product_id)} /> },
          { key: 'warehouse_id', label: 'Warehouse', render: (row) => warehouseName(row.warehouse_id) },
          { key: 'on_hand', label: 'On Hand Total', render: (row) => `${formatNumber(row.on_hand)} kg` },
          { key: 'reserved', label: 'Total Reserved', render: (row) => `${formatNumber(row.reserved)} kg` },
          { key: 'quarantined', label: 'Total Quarantined', render: (row) => `${formatNumber(row.quarantined)} kg` },
          { key: 'damaged', label: 'Total Damaged', render: (row) => `${formatNumber(row.damaged)} kg` },
          { key: 'available', label: 'Available Total for Sale', render: (row) => <span className="font-semibold text-green-700">{formatNumber(row.available)} kg</span> },
          { key: 'records', label: 'Stock Records' },
        ]}
        rows={reportRows}
        searchKeys={[(row) => productDetail(row.product_id).text, (row) => warehouseName(row.warehouse_id)]}
        searchPlaceholder="Search product or warehouse…"
        filters={<FilterSelect value={warehouseFilter} onChange={setWarehouseFilter} placeholder="All warehouses" options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} />}
        pageSize={12}
        emptyHint="No inventory records match this report."
      />
    </div>
  );
}
