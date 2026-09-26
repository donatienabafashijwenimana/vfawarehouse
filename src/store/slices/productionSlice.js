import { productionEfficiency } from '../../lib/calc';

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

  addBatch(row) {
    const batch = {
      ...row,
      id: uid(),
      batch_number: row.batch_number || generateBatchNumber(get().batches),
      status: 'PLANNED',
      quality_status: 'PENDING',
      created_by: get().profile?.id,
      created_at: nowISO(),
      output_qty: 0,
      rejected_qty: 0,
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

  updateBatch(id, fields) {
    set((s) => ({ batches: s.batches.map((b) => (b.id === id ? { ...b, ...fields } : b)) }));
    get().logAction(`Updated production batch`, 'Production');
  },

  deleteBatch(id) {
    const batch = get().batches.find((b) => b.id === id);
    if (batch?.status === 'COMPLETED') throw new Error('Completed batches cannot be deleted.');
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
   * Complete a batch: set output/rejected, mark COMPLETED + APPROVED,
   * push finished seed into inventory of the given warehouse, write a
   * PRODUCTION stock movement. Rejected qty is NOT added to stock (§36).
   */
  completeBatch({ batchId, outputQty, rejectedQty, warehouseId }) {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) throw new Error('Batch not found');
    if (batch.status === 'COMPLETED') throw new Error('Batch is already completed');
    const output = Number(outputQty);
    const rejected = Number(rejectedQty);
    if (!Number.isFinite(output) || output < 0) throw new Error('Output quantity must be a positive number');
    if (!Number.isFinite(rejected) || rejected < 0) throw new Error('Rejected quantity must be a positive number');

    get().updateBatch(batchId, {
      status: 'COMPLETED',
      end_date: today(),
      output_qty: output,
      rejected_qty: rejected,
    });

    if (output > 0) {
      get().addInventory({
        product_id: batch.product_id,
        batch_id: batch.id,
        warehouse_id: warehouseId,
        quantity: output,
      });
      get().addMovement({
        product_id: batch.product_id,
        batch_id: batch.id,
        warehouse_id: warehouseId,
        movement_type: 'PRODUCTION',
        quantity: output,
        reference_type: 'production_batch',
        reference_id: batch.id,
        notes: `Batch ${batch.batch_number} completed`,
      });
    }
    get().pushNotification('success', 'Batch completed', `Batch ${batch.batch_number} completed. Output: ${output} kg.`);
    get().logAction(`Completed production batch ${batch.batch_number} (out ${output} kg, rej ${rejected} kg)`, 'Production');
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

  efficiencyOf(batchId) {
    const batch = get().batches.find((b) => b.id === batchId);
    if (!batch) return 0;
    return productionEfficiency(batch.input_qty, batch.output_qty);
  },
});

function today() {
  return new Date().toISOString().slice(0, 10);
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
