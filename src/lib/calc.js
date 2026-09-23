// Business-rule calculations (spec §15, §23, §25, §36).

/** Production efficiency % = output / input × 100 (§15). */
export function productionEfficiency(inputQty, outputQty) {
  const input = Number(inputQty) || 0;
  const output = Number(outputQty) || 0;
  if (input <= 0) return 0;
  return Math.round((output / input) * 10000) / 100;
}

/** Payment status derived from paid vs total (§23/§36): PAID | PARTIAL | UNPAID. */
export function paymentStatus(total, paid) {
  const t = Number(total) || 0;
  const p = Number(paid) || 0;
  if (p <= 0) return 'UNPAID';
  if (p >= t) return 'PAID';
  return 'PARTIAL';
}

/** Net income = sales revenue − expenses (§25). */
export function netIncome(salesTotal, expensesTotal) {
  return (Number(salesTotal) || 0) - (Number(expensesTotal) || 0);
}

/** Sum of available quantities across inventory rows. */
export function totalAvailable(inventoryRows = []) {
  return inventoryRows.reduce((sum, row) => sum + (Number(row.available_qty ?? row.quantity) || 0), 0);
}

/** Row available = quantity − reserved − quarantined − damaged (never negative, §37). */
export function availableQty(row) {
  const q = Number(row.quantity) || 0;
  const reserved = Number(row.reserved_qty) || 0;
  const quarantined = Number(row.quarantined_qty) || 0;
  const damaged = Number(row.damaged_qty) || 0;
  return Math.max(0, q - reserved - quarantined - damaged);
}

/** Group array rows by a key, returning [{ key, rows }]. */
export function groupBy(rows = [], keyFn) {
  const map = new Map();
  for (const row of rows) {
    const k = typeof keyFn === 'function' ? keyFn(row) : row[keyFn];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
}
