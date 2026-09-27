import { productionEfficiency } from '../../lib/calc';
import { roundQty, unitOf } from '../../lib/units';
import { prettyLabel } from '../../lib/format';
import { batchStorageMissing } from '../../services/dataService';

const DEFAULT_STAGES = ['Land preparation', 'Planting', 'Crop management', 'Harvesting', 'Sorting and grading', 'Packaging'];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
const nowISO = () => new Date().toISOString();

export const PRODUCTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const QUALITY_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'QUARANTINED'];

/**
 * Production slice (spec §12–16): batches, stages, quality checks.
 * Completing an APPROVED batch increases inventory and writes a PRODUCTION
 * stock movement; rejected quantity never becomes sellable stock (§36).
 */
export const productionSlice = (set, get) => ({
  batches: [],
  stages: [],
  qualityChecks: [],

  /**
   * Add a batch to the store. When called after a direct database insert
   * (row already carries the database id), the database identity is kept so
   * the store mirror and the database row stay the same record.
   */
  addBatch(row) {
    const batch = {
      ...row,
      id: row.id ?? uid(),
      batch_number: row.batch_number || generateBatchNumber(get().batches),
      status: row.status ?? 'PLANNED',
      quality_status: row.quality_status ?? 'PENDING',
      // Where the output is stored, or will be. Null only for a batch that has
      // never been given one — allowed while it is open, refused once completed.
      warehouse_id: row.warehouse_id ?? null,
      created_by: row.created_by ?? get().profile?.id,
      created_at: row.created_at ?? nowISO(),
      output_qty: row.output_qty ?? 0,
      rejected_qty: row.rejected_qty ?? 0,
    };
    set((s) => ({ batches: [batch, ...s.batches] }));
    // Pre-create stage pipeline
    const stageRows = DEFAULT_STAGES.map((name, i) => ({
      id: uid(),
      batch_id: batch.id,
      name,
      sequence: i + 1,
      status: 'PENDING',
      started_at: null,
      completed_at: null,
      notes: '',
    }));
    set((s) => ({ stages: [...s.stages, ...stageRows] }));
    get().logAction(`Created production batch ${batch.batch_number}`, 'Production');
    get().pushNotification('info', 'Batch created', `Batch ${batch.batch_number} was created and planned.`);
    return batch;
  },

  /**
   * Update a batch, including one that is already COMPLETED. Every status is
   * editable: corrections to a finished batch never re-run the completion flow.
   * The stock a completed batch booked is not touched here either — the database
   * function owns that, and a correction made from the Edit form is written
   * through it so the batch and the shelf cannot drift apart.
   */
  updateBatch(id, fields) {
    const batch = get().batches.find((b) => b.id === id);
    if (!batch) throw new Error('Batch not found');
    const next = { ...batch, ...fields };
    assertEditableBatch(next, get().batches.filter((b) => b.id !== id));
    set((s) => ({ batches: s.batches.map((b) => (b.id === id ? next : b)) }));
    get().logAction(`Updated production batch ${batch.batch_number}`, 'Production');
  },

  deleteBatch(id) {
    const batch = get().batches.find((b) => b.id === id);
    if (get().inventory.some((row) => row.batch_id === id)) {
      throw new Error('Batches with inventory cannot be deleted. Remove or reassign the inventory first.');
    }
    set((s) => ({
      batches: s.batches.filter((b) => b.id !== id),
      stages: s.stages.filter((st) => st.batch_id !== id),
      qualityChecks: s.qualityChecks.filter((q) => q.batch_id !== id),
    }));
    get().logAction(`Deleted production batch ${batch?.batch_number}`, 'Production');
  },

  startBatch(id) {
    get().updateBatch(id, { status: 'IN_PROGRESS', start_date: today() });
  },

  cancelBatch(id) {
    get().updateBatch(id, { status: 'CANCELLED' });
    get().logAction(`Cancelled production batch`, 'Production');
  },

  updateStage(stageId, fields) {
    set((s) => ({ stages: s.stages.map((st) => (st.id === stageId ? { ...st, ...fields } : st)) }));
  },

  startStage(stageId) {
    get().updateStage(stageId, { status: 'IN_PROGRESS', started_at: nowISO() });
    const stage = get().stages.find((st) => st.id === stageId);
    get().logAction(`Started stage "${stage?.name}"`, 'Production Stages');
  },

  completeStage(stageId, notes) {
    get().updateStage(stageId, { status: 'COMPLETED', completed_at: nowISO(), notes });
    const stage = get().stages.find((st) => st.id === stageId);
    get().logAction(`Completed stage "${stage?.name}"`, 'Production Stages');
    get().pushNotification('info', 'Stage completed', `Stage "${stage?.name}" was completed.`);
  },

  /**
   * Check a completion and resolve it to the exact numbers that will be written,
   * without changing anything. The caller hands the result to
   * rpc_complete_production_batch and then to applyBatchCompletion, so what the
   * database is asked for and what the store records cannot drift apart.
   *
   * The output is not necessarily what was planted: a farmer can sow one product
   * and finish with another, so outputProductId names what the batch actually
   * produced and both output and rejected are counted in *that* product's unit.
   * The stock is booked against the output product for the same reason. The two
   * quantities are never converted into one another, because they are different
   * products in different units rather than two units of one product.
   */
  resolveBatchCompletion({ batchId, outputQty, rejectedQty, warehouseId, outputProductId }) {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) throw new Error('Batch not found');
    if (batch.status === 'COMPLETED') throw new Error('Batch is already completed');

    const productId = outputProductId || batch.output_product_id || batch.product_id;
    const product = get().products.find((p) => p.id === productId);
    if (!product) throw new Error('The output product could not be found');
    if (product.status === 'INACTIVE') throw new Error(`${product.name} is inactive and cannot be received into stock`);

    // Two different faults, so they are not reported as one: nothing chosen is the
    // operator's to fix, while a named warehouse that is absent is a stale workspace
    // and would otherwise read as though they had forgotten to pick one.
    if (!warehouseId) throw new Error(`Batch ${batch.batch_number} cannot be completed without the warehouse its output is stored in`);
    const warehouse = get().warehouses.find((w) => w.id === warehouseId);
    if (!warehouse) throw new Error('The output warehouse could not be found');

    const output = roundQty(outputQty);
    const rejected = roundQty(rejectedQty);
    if (!Number.isFinite(output) || output < 0) throw new Error('Output quantity must be a positive number');
    if (!Number.isFinite(rejected) || rejected < 0) throw new Error('Rejected quantity must be a positive number');

    return { batch, product, productId, warehouseId, output, rejected };
  },

  /**
   * Record a completion the database has already confirmed.
   *
   * The batch, the stock row and the movement are all read back out of
   * rpc_complete_production_batch rather than assembled here, so the store holds
   * the database's own rows — same ids, same quantities. Building them locally
   * instead gives the stock row a fresh id for a row the database already has,
   * and the next diff-sync then collides with the unique index on
   * (product_id, batch_id, warehouse_id) or books the output a second time.
   */
  applyBatchCompletion({ batch, inventory, movement }) {
    if (!batch) throw new Error('The database did not return the completed batch');

    set((s) => ({
      batches: s.batches.map((b) => (b.id === batch.id ? batch : b)),
      inventory: inventory ? upsertById(s.inventory, inventory) : s.inventory,
      movements: movement ? upsertById(s.movements, movement) : s.movements,
    }));

    const product = get().products.find((p) => p.id === batch.output_product_id);
    const planted = get().products.find((p) => p.id === batch.product_id);
    const changed = planted && batch.product_id !== batch.output_product_id;
    const counted = (qty) => `${qty} ${unitOf(product)}`;
    const origin = changed && planted ? ` planted as ${planted.name}` : '';
    get().pushNotification('success', 'Batch completed', `Batch ${batch.batch_number} completed${origin}. Output: ${counted(batch.output_qty)} of ${product?.name ?? 'the output product'}.`);
    get().logAction(`Completed production batch ${batch.batch_number} (out ${counted(batch.output_qty)}, rej ${counted(batch.rejected_qty)} of ${product?.name ?? 'the output product'})`, 'Production');
  },

  /**
   * Record an edit the database has already confirmed.
   *
   * Unlike a completion, an edit can *remove* rows: re-pointing the output product
   * merges this batch's stock into a row the batch did not have, and correcting the
   * output to zero drops the movement that booked it. So this replaces the batch's
   * rows with the set the database returned rather than upserting onto whatever is
   * already there. Upserting alone would leave an orphan in the store, and the next
   * diff-sync would helpfully write it back.
   *
   * Only the batch's own bookkeeping movements are touched. A sale movement carries
   * this batch_id too, and it is not the function's to rewrite.
   */
  applyBatchEdit({
    batch,
    previousStatus,
    // Defaults to the batch's own warehouse, so a caller that does not know it is
    // never told the stock was relocated on a guess.
    previousWarehouseId = batch?.warehouse_id ?? null,
    inventoryRows = [],
    movementRows = [],
  }) {
    if (!batch) throw new Error('The database did not return the updated batch');

    // Every movement the function may have rewritten for this batch: the PRODUCTION
    // entry that booked the output, the release entries written when a batch is
    // reopened, and the transfer pair written when its storage warehouse changes.
    // PRODUCTION is matched on batch_id alone, because that is the only
    // thing it can be — and batches completed before the completion function existed
    // have no reference_type to match on. A SALE movement carries this batch_id too
    // and is none of this function's business.
    const managed = (m) =>
      m.batch_id === batch.id
      && (m.movement_type === 'PRODUCTION' || m.reference_type === 'production_batch');

    set((s) => ({
      batches: s.batches.map((b) => (b.id === batch.id ? batch : b)),
      inventory: inventoryRows.reduce(
        upsertById,
        s.inventory.filter((r) => r.batch_id !== batch.id)
      ),
      movements: movementRows.reduce(
        upsertById,
        s.movements.filter((m) => !managed(m))
      ),
    }));

    const product = get().products.find((p) => p.id === batch.output_product_id);
    const unit = unitOf(product);
    const warehouseName = (id) => get().warehouses.find((w) => w.id === id)?.name ?? '—';
    // The caller holds the status and the warehouse from before the edit, which is
    // the only place they exist — by the time this runs the store has already been
    // overwritten.
    const released = previousStatus === 'COMPLETED' && batch.status !== 'COMPLETED';
    const relocated = previousWarehouseId !== batch.warehouse_id
      ? `, storage ${warehouseName(previousWarehouseId)} → ${warehouseName(batch.warehouse_id)}`
      : '';

    get().logAction(
      `Updated production batch ${batch.batch_number} (status ${prettyLabel(batch.status)}${
        released ? ', stock released' : ''
      }${relocated}, output ${batch.output_qty} ${unit} of ${product?.name ?? 'the output product'})`,
      'Production'
    );
  },

  addQualityCheck(row) {
    const qc = { ...row, id: uid(), inspector: get().profile?.fullName ?? 'Unknown', inspector_id: get().profile?.id, created_at: nowISO() };
    set((s) => ({ qualityChecks: [qc, ...s.qualityChecks] }));
    get().updateBatch(qc.batch_id, { quality_status: qc.status });
    if (qc.status === 'APPROVED') get().updateBatch(qc.batch_id, { approved: true });
    get().logAction(`Quality check recorded (${qc.status})`, 'Quality Control');
    get().pushNotification(
      qc.status === 'APPROVED' ? 'success' : qc.status === 'REJECTED' ? 'danger' : 'info',
      'Quality check recorded',
      `Batch check result: ${qc.status}`
    );
  },

  updateQualityCheck(id, fields) {
    set((s) => ({ qualityChecks: s.qualityChecks.map((q) => (q.id === id ? { ...q, ...fields } : q)) }));
    get().logAction(`Updated quality check`, 'Quality Control');
  },

  /**
   * The product a batch actually produced, which is not always the one planted.
   * Callers use it to label output and to work out which unit the batch's output
   * and rejected quantities are counted in.
   */
  outputProductOf(batchId) {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return null;
    const productId = batch.output_product_id ?? batch.product_id;
    return get().products.find((p) => p.id === productId) ?? null;
  },

  /**
   * Whether a batch's efficiency can be calculated at all. Efficiency is
   * output ÷ input, so it only means something when both figures are the same
   * product in the same unit. A batch planted as one product and finished as
   * another has no comparable ratio, and callers show nothing rather than a
   * number that would be meaningless.
   */
  efficiencyComparable(batch) {
    if (!batch) return false;
    const outputProductId = batch.output_product_id ?? batch.product_id;
    return outputProductId === batch.product_id;
  },

  efficiencyOf(batchId) {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch || !get().efficiencyComparable(batch)) return null;
    return productionEfficiency(batch.input_qty, batch.output_qty);
  },

  /**
   * Snapshot of the three row sets a batch completion or correction writes, taken
   * before the change is applied. Pair with restoreWrite when the database
   * refuses the change, so the batch is not left on screen as completed — or with
   * stock booked in — that PostgreSQL never accepted.
   */
  snapshotWrite() {
    const state = get();
    return { batches: state.batches, inventory: state.inventory, movements: state.movements };
  },

  /**
   * Put those rows back exactly as they were. The arrays are replaced wholesale,
   * which is safe because a completion is applied from a blocking dialog with
   * nothing else writing to them at the same time.
   */
  restoreWrite(snapshot) {
    if (!snapshot) return;
    // The rows go back first, because that is what the operator is looking at: a
    // failure while rewriting the baseline bookkeeping must not leave the store
    // still showing the change the database refused. The baseline then follows,
    // from the same captured snapshot, so the two cannot disagree about which rows
    // were pre-write.
    set({ batches: snapshot.batches, inventory: snapshot.inventory, movements: snapshot.movements });
    // The baseline has to go back with the rows. A write that is rolled back in
    // the store alone leaves the baseline describing rows the database holds and
    // the store no longer has, and the next sync reads that as a deletion.
    get().revertBaseline(snapshot);
    get().logAction('Discarded a batch change the database refused', 'Production');
  },
});

/** Replace the row carrying this id, or append it when the store has not seen it. */
function upsertById(rows, row) {
  const index = rows.findIndex((r) => r.id === row.id);
  if (index === -1) return [row, ...rows];
  const next = rows.slice();
  next[index] = row;
  return next;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Mirrors the production_batches column constraints so a bad edit is rejected in
 * the store instead of failing later during the workspace sync.
 */
function assertEditableBatch(batch, siblings) {
  const number = String(batch.batch_number ?? '').trim();
  if (!number) throw new Error('Batch number is required');
  if (siblings.some((b) => String(b.batch_number).trim().toLowerCase() === number.toLowerCase())) {
    throw new Error(`Batch number ${number} is already used by another batch`);
  }
  if (!batch.product_id) throw new Error('A batch must be linked to a product');
  if (!PRODUCTION_STATUSES.includes(batch.status)) throw new Error(`Unknown production status "${batch.status}"`);
  if (!QUALITY_STATUSES.includes(batch.quality_status)) throw new Error(`Unknown quality status "${batch.quality_status}"`);

  const input = Number(batch.input_qty);
  if (!Number.isFinite(input) || input <= 0) throw new Error('Input quantity must be greater than zero');
  for (const [key, label] of [['output_qty', 'Output quantity'], ['rejected_qty', 'Rejected quantity']]) {
    const value = Number(batch[key] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} cannot be negative`);
  }
  if (batch.start_date && batch.end_date && batch.end_date < batch.start_date) {
    throw new Error('End date cannot be earlier than the start date');
  }
  // completion_unit / completion_unit_factor were dropped by
  // 20260927000007_batch_output_product.sql: a completed batch now names the
  // product its output is counted in (output_product_id) rather than converting
  // between two units of one product.
  if (batch.status === 'COMPLETED' && !batch.output_product_id) {
    throw new Error('A completed batch must name the product its output is counted in');
  }
  // production_batches_storage_warehouse: stock that has been booked has to be
  // somewhere, so a completed batch has to say where. Caught here rather than
  // failing later during the workspace sync, where the message is a constraint name.
  //
  // Skipped while the database has no such column. Every completed batch reads back
  // without one then, so enforcing it would refuse to edit any of them over a
  // feature that is not switched on yet, and the constraint does not exist to catch
  // it either — the check would be the only thing standing in the way.
  if (batch.status === 'COMPLETED' && !batch.warehouse_id && !batchStorageMissing()) {
    throw new Error('A completed batch must name the warehouse its output is stored in');
  }
}

export function generateBatchNumber(existing = []) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((b) => b.batch_number)
    .filter((n) => typeof n === 'string' && n.startsWith(`PB-${year}-`))
    .map((n) => parseInt(n.split('-')[2], 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `PB-${year}-${String(next).padStart(3, '0')}`;
}
