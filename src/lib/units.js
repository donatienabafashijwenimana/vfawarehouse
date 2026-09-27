// Units and the unit-aware totals built on them.
//
// A farmer plants one product and can finish with another, so a quantity is only
// ever meaningful next to the product it belongs to. There is no conversion
// between units here on purpose: each product carries its own unit and its
// quantities are counted in that unit. Totals therefore group by product and unit
// (see groupByUnit below) rather than adding a kilogram total to a bag total.

/** Units offered in pickers, merged with the units products actually use. */
export const UNIT_OPTIONS = [
  'kg', 'g', 't', 'l', 'pcs',
  'bag', 'sack', 'crate', 'box', 'tray', 'pallet', 'bunch',
];

/** Stored quantities are numeric(12,2), so figures keep two decimals. */
const QTY_DECIMALS = 2;

/** Rounds off binary floating-point noise (0.1 + 0.2) before a quantity is stored. */
export function roundQty(value, decimals = QTY_DECIMALS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(decimals));
}

/** The unit a product is counted in, with 'kg' only as a last resort. */
export function unitOf(product) {
  return String(product?.unit ?? '').trim() || 'kg';
}

/**
 * Resolves a product id to that product's unit, for rows that only carry a
 * product_id. Built once per page so a total over a few thousand rows is a map
 * lookup each rather than a scan, and so every total on a page resolves units the
 * same way.
 */
export function unitLookup(products = []) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return (productId) => unitOf(byId.get(productId));
}

/** Picker options: the given unit first, then the known vocabulary, then any other unit in use. */
export function unitOptions(products = [], baseUnit) {
  const options = [];
  const seen = new Set();
  for (const candidate of [baseUnit, ...UNIT_OPTIONS, ...products.map((p) => p?.unit)]) {
    const unit = String(candidate ?? '').trim();
    const key = unit.toLowerCase();
    if (!unit || seen.has(key)) continue;
    seen.add(key);
    options.push(unit);
  }
  return options;
}

/**
 * Groups rows that carry a quantity so each group shares one unit, which is the
 * only way a total can be added up honestly.
 *
 * `unitOfRow` returns the unit for a single row, and each group is keyed by that
 * unit. A `labelOf` supplies the extra dimension to break ties when totals are
 * grouped by product as well: without it, "40 bags" and "12 crates" of the same
 * product would be listed as one line.
 *
 * Returns `[{ key, label, unit, total }]`, largest total first, which is the
 * order a reader expects when scanning a list of totals.
 */
export function groupByUnit(rows, { unitOfRow, totalOf = (row) => Number(row) || 0, labelOf = () => '' } = {}) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const unit = String(unitOfRow(row) ?? '').trim() || 'kg';
    const label = String(labelOf(row) ?? '').trim();
    const key = label ? `${label.toLowerCase()}::${unit.toLowerCase()}` : unit.toLowerCase();
    const group = groups.get(key) ?? { key, label, unit, total: 0 };
    group.total = roundQty(group.total + (Number(totalOf(row)) || 0));
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total);
}

/** Renders one group of groupByUnit output as "3,500 kg", or "1,200 kg Red Onions". */
export function formatGroup(group, { withLabel = false } = {}) {
  const qty = new Intl.NumberFormat('en-US', { maximumFractionDigits: QTY_DECIMALS }).format(group.total);
  return withLabel && group.label ? `${qty} ${group.unit} ${group.label}` : `${qty} ${group.unit}`;
}
