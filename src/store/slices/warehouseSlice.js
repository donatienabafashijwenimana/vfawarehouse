import { availableQty } from '../../lib/calc';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
const nowISO = () => new Date().toISOString();

/**
 * Last line of defence for §37: on-hand stock never goes negative and always
 * still covers what is reserved, quarantined or written off against the row.
 * Runs after every mutation so a newly added movement type cannot skip it.
 */
function assertStockLevels(row) {
  const quantity = Number(row.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Stock quantity cannot be negative');
  const committed =
    (Number(row.reserved_qty) || 0) + (Number(row.quarantined_qty) || 0) + (Number(row.damaged_qty) || 0);
  if (committed > quantity) {
    throw new Error(`Stock of ${quantity} kg is less than the ${committed} kg already reserved, quarantined or damaged`);
  }
}

export const MOVEMENT_TYPES = ['PRODUCTION', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER', 'RESERVATION', 'RELEASE', 'QUARANTINE', 'RELEASE_QUARANTINE'];

/**
 * Warehouse slice (spec §17–19, §37): warehouses, inventory rows, stock
 * movements. All inventory changes flow through applyMovement so every change
 * has a movement record (full audit trail). Available qty can never go negative.
 */
export const warehouseSlice = (set, get) => ({
  warehouses: [],
  inventory: [],
  movements: [],

  // ---- Warehouses ----
  addWarehouse(row) {
    set((s) => ({ warehouses: [...s.warehouses, { ...row, id: uid() }] }));
    get().logAction(`Created warehouse "${row.name}"`, 'Warehouses');
  },
  updateWarehouse(id, fields) {
    set((s) => ({ warehouses: s.warehouses.map((w) => (w.id === id ? { ...w, ...fields } : w)) }));
    get().logAction(`Updated warehouse`, 'Warehouses');
  },

  // ---- Inventory ----
  addInventory({ product_id, batch_id, warehouse_id, quantity }) {
    const qty = Number(quantity);
    if (!product_id) throw new Error('Inventory must be linked to a product');
    if (!warehouse_id) throw new Error('Inventory must be linked to a warehouse');
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Stock-in quantity must be a positive number');

    const existing = get().inventory.find(
      (i) =>
        i.product_id === product_id &&
        (i.batch_id ?? null) === (batch_id ?? null) &&
        i.warehouse_id === warehouse_id
    );
    if (existing) {
      const merged = { ...existing, quantity: (Number(existing.quantity) || 0) + qty };
      assertStockLevels(merged);
      set((s) => ({ inventory: s.inventory.map((i) => (i.id === existing.id ? merged : i)) }));
      return existing.id;
    }
    const row = {
      id: uid(),
      product_id,
      batch_id: batch_id ?? null,
      warehouse_id,
      quantity: qty,
      reserved_qty: 0,
      quarantined_qty: 0,
      damaged_qty: 0,
      updated_at: nowISO(),
    };
    assertStockLevels(row);
    set((s) => ({ inventory: [...s.inventory, row] }));
    return row.id;
  },

  /** Core inventory mutation — always paired with a stock movement (§37). */
  applyMovement(mv) {
    const {
      product_id,
      batch_id = null,
      warehouse_id,
      movement_type,
      quantity,
      reference_type = null,
      reference_id = null,
      notes = '',
      to_warehouse_id = null,
    } = mv;
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Movement quantity must be a positive number');
    if (!MOVEMENT_TYPES.includes(movement_type)) throw new Error(`Unknown movement type: ${movement_type}`);

    const inv = get().inventory.find(
      (i) => i.product_id === product_id && (i.batch_id ?? null) === (batch_id ?? null) && i.warehouse_id === warehouse_id
    );
    const row = inv ?? {
      id: uid(),
      product_id,
      batch_id,
      warehouse_id,
      quantity: 0,
      reserved_qty: 0,
      quarantined_qty: 0,
      damaged_qty: 0,
      updated_at: nowISO(),
    };

    switch (movement_type) {
      case 'PRODUCTION':
      case 'RETURN':
      case 'ADJUSTMENT_IN':
        row.quantity += qty;
        break;
      case 'SALE':
      case 'ADJUSTMENT_OUT':
        if (availableQty(row) < qty) {
          throw new Error('Insufficient available stock (§37: negative stock is not allowed)');
        }
        row.quantity -= qty;
        break;
      case 'DAMAGE':
        if (availableQty(row) < qty) {
          throw new Error('Insufficient available stock (§37: negative stock is not allowed)');
        }
        row.damaged_qty += qty;
        break;
      case 'RESERVATION':
        if (availableQty(row) < qty) throw new Error('Insufficient available stock to reserve');
        row.reserved_qty += qty;
        break;
      case 'RELEASE':
        if ((row.reserved_qty ?? 0) < qty) throw new Error('Release quantity exceeds reserved stock');
        row.reserved_qty -= qty;
        break;
      case 'QUARANTINE':
        if (availableQty(row) < qty) throw new Error('Insufficient available stock to quarantine');
        row.quarantined_qty += qty;
        break;
      case 'RELEASE_QUARANTINE':
        if ((row.quarantined_qty ?? 0) < qty) throw new Error('Release quantity exceeds quarantined stock');
        row.quarantined_qty -= qty;
        break;
      case 'TRANSFER':
        if (!to_warehouse_id) throw new Error('TRANSFER requires a destination warehouse — use transferStock()');
        if (to_warehouse_id === warehouse_id) throw new Error('Source and destination warehouses must differ');
        if (availableQty(row) < qty) {
          throw new Error('Insufficient available stock to transfer (§37: negative stock is not allowed)');
        }
        row.quantity -= qty;
        break;
      default:
        break;
    }

    row.updated_at = nowISO();
    assertStockLevels(row);
    set((s) => ({
      inventory: inv
        ? s.inventory.map((i) => (i.id === row.id ? { ...row } : i))
        : [...s.inventory, row],
    }));

    get().addMovement({
      product_id,
      batch_id,
      warehouse_id,
      movement_type,
      quantity: qty,
      reference_type,
      reference_id,
      notes,
    });

    // A transfer leaves the company stock position unchanged, so it must not
    // read as a receipt or an issue. The destination leg is recorded as its own
    // TRANSFER movement on the same reference, and the two rows pair up by
    // warehouse instead of inflating Stock In / Stock Out.
    if (movement_type === 'TRANSFER') {
      const destInv = get().inventory.find(
        (i) => i.product_id === product_id && (i.batch_id ?? null) === (batch_id ?? null) && i.warehouse_id === to_warehouse_id
      );
      const destRow = destInv
        ? { ...destInv, quantity: (Number(destInv.quantity) || 0) + qty, updated_at: nowISO() }
        : {
            id: uid(),
            product_id,
            batch_id,
            warehouse_id: to_warehouse_id,
            quantity: qty,
            reserved_qty: 0,
            quarantined_qty: 0,
            damaged_qty: 0,
            updated_at: nowISO(),
          };
      assertStockLevels(destRow);
      set((s) => ({
        inventory: destInv
          ? s.inventory.map((i) => (i.id === destRow.id ? destRow : i))
          : [...s.inventory, destRow],
      }));
      get().addMovement({
        product_id,
        batch_id,
        warehouse_id: to_warehouse_id,
        movement_type: 'TRANSFER',
        quantity: qty,
        reference_type,
        reference_id,
        notes,
      });
    }

    // Stock levels changed — surface any product that dropped to/below its
    // minimum threshold so alerts stay live during the session (§29).
    if (['SALE', 'DAMAGE', 'ADJUSTMENT_OUT', 'TRANSFER'].includes(movement_type)) {
      get().checkLowStock();
    }
  },

  transferStock({ product_id, batch_id, from_warehouse, to_warehouse, quantity, notes }) {
    if (from_warehouse === to_warehouse) throw new Error('Source and destination warehouses must differ');
    get().applyMovement({
      product_id, batch_id, warehouse_id: from_warehouse, to_warehouse_id: to_warehouse,
      movement_type: 'TRANSFER', quantity,
      reference_type: 'inventory_transfer', reference_id: uid(),
      notes: notes || 'Transfer between warehouses',
    });
    get().logAction('Transferred stock between warehouses', 'Inventory');
  },

  adjustInventory({ product_id, batch_id, warehouse_id, direction, quantity, notes }) {
    get().applyMovement({
      product_id, batch_id, warehouse_id,
      movement_type: direction === 'in' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity, notes,
    });
    get().logAction(`Inventory adjustment (${direction})`, 'Inventory');
  },

  markDamaged({ product_id, batch_id, warehouse_id, quantity, notes }) {
    get().applyMovement({
      product_id, batch_id, warehouse_id, movement_type: 'DAMAGE', quantity, notes,
    });
    get().logAction('Marked stock as damaged', 'Inventory');
  },

  reserveStock({ product_id, batch_id, warehouse_id, quantity, notes }) {
    get().applyMovement({ product_id, batch_id, warehouse_id, movement_type: 'RESERVATION', quantity, notes: notes || 'Stock reserved' });
    get().logAction('Reserved stock', 'Inventory');
  },

  releaseReservedStock({ product_id, batch_id, warehouse_id, quantity, notes }) {
    const qty = Number(quantity);
    const stock = get().inventory.find((row) => row.product_id === product_id && (row.batch_id ?? null) === (batch_id ?? null) && row.warehouse_id === warehouse_id);
    const orderReserved = get().orders
      .filter((order) => ['CONFIRMED', 'PROCESSING', 'READY'].includes(order.status))
      .flatMap((order) => order.items ?? [])
      .filter((item) => item.product_id === product_id && (item.batch_id ?? null) === (batch_id ?? null) && item.warehouse_id === warehouse_id)
      .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    if (!stock || qty > Math.max(0, Number(stock.reserved_qty) - orderReserved)) {
      throw new Error('Stock reserved for active orders cannot be restored here. Cancel or update the order first.');
    }
    get().applyMovement({ product_id, batch_id, warehouse_id, movement_type: 'RELEASE', quantity, notes: notes || 'Reserved stock restored to available' });
    get().logAction('Restored reserved stock to available', 'Inventory');
  },

  quarantineStock({ product_id, batch_id, warehouse_id, quantity, notes }) {
    get().applyMovement({ product_id, batch_id, warehouse_id, movement_type: 'QUARANTINE', quantity, notes: notes || 'Stock quarantined' });
    get().logAction('Quarantined stock', 'Inventory');
  },

  releaseQuarantine({ product_id, batch_id, warehouse_id, quantity, notes }) {
    get().applyMovement({ product_id, batch_id, warehouse_id, movement_type: 'RELEASE_QUARANTINE', quantity, notes: notes || 'Quarantine released' });
    get().logAction('Released quarantined stock', 'Inventory');
  },

  addMovement(row) {
    set((s) => ({
      movements: [
        {
          ...row,
          id: uid(),
          created_by: get().profile?.fullName ?? get().profile?.email ?? 'system',
          created_by_id: get().profile?.id,
          created_at: nowISO(),
        },
        ...s.movements,
      ],
    }));
  },

  availableFor(productId, warehouseId = null) {
    return get()
      .inventory.filter(
        (i) => i.product_id === productId && (warehouseId == null || i.warehouse_id === warehouseId)
      )
      .reduce((sum, i) => sum + availableQty(i), 0);
  },
});
