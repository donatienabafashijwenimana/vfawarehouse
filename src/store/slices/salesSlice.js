import { availableQty, paymentStatus } from '../../lib/calc';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
const nowISO = () => new Date().toISOString();

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'];
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Mobile Money', 'Advance', 'Other'];

/**
 * Sales slice (spec §20–23, §36): customers, orders, sales/invoices, payments.
 * Order lifecycle reserves/releases stock; sale confirmation decreases stock.
 */
export const salesSlice = (set, get) => ({
  customers: [],
  orders: [],
  sales: [],
  payments: [],

  // ---- Customers ----
  addCustomer(row) {
    const customer = { ...row, id: uid(), outstanding: 0, created_at: nowISO() };
    set((s) => ({ customers: [...s.customers, customer] }));
    get().logAction(`Created customer "${row.name}"`, 'Customers');
  },
  updateCustomer(id, fields) {
    set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...fields } : c)) }));
    get().logAction(`Updated customer`, 'Customers');
  },
  deleteCustomer(id) {
    const used = get().orders.some((o) => o.customer_id === id)
      || get().sales.some((s) => s.customer_id === id)
      || get().payments.some((payment) => payment.customer_id === id);
    if (used) throw new Error('Cannot delete a customer with orders, sales, or payments. Deactivate instead.');
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
    get().logAction(`Deleted customer`, 'Customers');
  },

  // ---- Orders ----
  placeOrder({ customer_id, items, paid_amount = 0, notes }) {
    if (!customer_id) throw new Error('An order must be linked to a customer');
    const customer = get().customers.find((c) => c.id === customer_id);
    if (!customer) throw new Error('Customer not found');
    const expectedAmount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
    const paidAmount = Number(paid_amount) || 0;
    if (paidAmount < 0 || paidAmount > expectedAmount) throw new Error('Paid amount must be between zero and the expected amount');
    const order = {
      id: uid(),
      order_number: generateOrderNumber(get().orders),
      customer_id,
      status: 'PENDING',
      created_by: get().profile?.id,
      items: items.map((it) => ({ ...it, id: it.id ?? uid() })),
      expected_amount: expectedAmount,
      paid_amount: paidAmount,
      remaining_amount: expectedAmount - paidAmount,
      payment_status: paymentStatus(expectedAmount, paidAmount),
      notes: notes || '',
      created_at: nowISO(),
    };
    set((s) => ({ orders: [order, ...s.orders] }));

    // A prepayment is real money: record it as a payment entry (attached to
    // the order until invoicing) so finance totals and receivables stay exact
    // instead of silently dropping the amount at sale time (§23).
    if (paidAmount > 0) {
      get().recordPayment({
        customer_id,
        order_id: order.id,
        order_number: order.order_number,
        amount: paidAmount,
        method: 'Advance',
        reference: `Prepayment — ${order.order_number}`,
      });
    }

    get().logAction(`Order ${order.order_number} placed`, 'Orders');
    get().pushNotification('info', 'New order', `Order ${order.order_number} awaiting confirmation.`);
    return order;
  },

  /** Confirm order → reserve stock for every line (§36). */
  confirmOrder(orderId, confirmedItems = null) {
    const order = get().orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PENDING') throw new Error('Only pending orders can be confirmed');

    // Validate the whole order before reserving anything, so a short line
    // cannot leave earlier lines partially reserved.
    const allocations = [];
    const remainingByStock = new Map();
    for (const item of confirmedItems ?? order.items) {
      const quantity = Number(item.quantity);
      if (!item.warehouse_id) throw new Error('Select a warehouse for every order item');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Confirmed quantities must be positive');
      const candidates = get().inventory.filter((row) =>
        row.product_id === item.product_id && row.warehouse_id === item.warehouse_id &&
        (item.batch_id == null || (row.batch_id ?? null) === item.batch_id)
      );
      let outstanding = quantity;
      for (const stock of candidates) {
        const remaining = remainingByStock.has(stock.id) ? remainingByStock.get(stock.id) : availableQty(stock);
        const allocated = Math.min(remaining, outstanding);
        if (allocated > 0) {
          allocations.push({
            ...item,
            batch_id: stock.batch_id ?? null,
            warehouse_id: item.warehouse_id,
            quantity: allocated,
          });
          remainingByStock.set(stock.id, remaining - allocated);
          outstanding -= allocated;
        }
        if (outstanding <= 0) break;
      }
      if (outstanding > 0) throw new Error('Insufficient available stock to confirm this order');
    }

    for (const item of allocations) {
      get().applyMovement({
        product_id: item.product_id,
        batch_id: item.batch_id ?? null,
        warehouse_id: item.warehouse_id ?? get().warehouses[0]?.id,
        movement_type: 'RESERVATION',
        quantity: item.quantity,
        reference_type: 'order',
        reference_id: order.id,
        notes: `Reserved for order ${order.order_number}`,
      });
    }
    get().updateOrder(orderId, { status: 'CONFIRMED', items: allocations });
    get().logAction(`Order ${order.order_number} confirmed — stock reserved`, 'Orders');
    get().pushNotification('success', 'Order confirmed', `Order ${order.order_number} confirmed — stock reserved.`);
  },

  updateOrder(id, fields) {
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...fields } : o)) }));
  },

  deletePendingOrder(id) {
    const order = get().orders.find((item) => item.id === id);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'PENDING') throw new Error('Only pending orders can be deleted');
    const hasPayment = Number(order.paid_amount) > 0 || get().payments.some((payment) => payment.order_id === id);
    if (hasPayment) throw new Error('This order has recorded payments and cannot be deleted. Contact staff to resolve the payment first.');
    set((s) => ({ orders: s.orders.filter((item) => item.id !== id) }));
    get().logAction(`Deleted pending order ${order.order_number}`, 'Orders');
  },

  /**
   * Manual status transitions for orders. COMPLETED is only ever reached
   * through createSale (stock leaves the warehouse) and CANCELLED only
   * through cancelOrder (reserved stock is released) — setting either here
   * would leak reservations or skip inventory, so they are blocked.
   */
  setOrderStatus(id, status) {
    const order = get().orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    const allowed = {
      PROCESSING: ['CONFIRMED'],
      READY: ['CONFIRMED', 'PROCESSING'],
    };
    const targets = allowed[status];
    if (!targets) throw new Error(`Cannot set "${status}" directly (use Invoice/Cancel/Confirm actions)`);
    if (!targets.includes(order.status)) {
      throw new Error(`Order cannot move from ${order.status} to ${status}`);
    }
    get().updateOrder(id, { status });
    get().logAction(`Order ${order.order_number} → ${status}`, 'Orders');
  },

  /** Cancel order → release reserved stock (§36). */
  cancelOrder(id) {
    const order = get().orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new Error(`Cannot cancel a ${order.status.toLowerCase()} order`);
    }
    if (order.status === 'CONFIRMED' || order.status === 'PROCESSING' || order.status === 'READY') {
      for (const item of order.items) {
        get().applyMovement({
          product_id: item.product_id,
          batch_id: item.batch_id ?? null,
          warehouse_id: item.warehouse_id ?? get().warehouses[0]?.id,
          movement_type: 'RELEASE',
          quantity: item.quantity,
          reference_type: 'order',
          reference_id: order.id,
          notes: `Released — order ${order.order_number} cancelled`,
        });
      }
    }
    get().updateOrder(id, { status: 'CANCELLED' });
    get().logAction(`Cancelled order ${order.order_number}`, 'Orders');
  },

  /**
   * Create a sale from an order (or standalone): decreases stock, computes
   * totals, sets payment status (§36). Prevents overselling.
   *
   * When fulfilling an order whose stock was reserved at confirmation, each
   * SALE line is paired with a RELEASE so reserved_qty is not permanently
   * leaked (§36: cancel releases, complete converts reservation into a sale).
   */
  createSale({ customer_id, items, discount = 0, order_id = null, notes = '' }) {
    const products = get().products;
    const order = order_id ? get().orders.find((o) => o.id === order_id) : null;
    if (order_id && !order) throw new Error('Order not found');
    if (order && ['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new Error(`Cannot create a sale for a ${order.status.toLowerCase()} order`);
    }

    let subtotal = 0;
    const saleItems = items.map((it) => {
      const product = products.find((p) => p.id === it.product_id);
      const price = Number(it.unit_price ?? product?.selling_price ?? 0);
      const qty = Number(it.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Sale quantities must be positive');
      subtotal += qty * price;
      return { ...it, id: it.id ?? uid(), unit_price: price, subtotal: qty * price };
    });
    const total = Math.max(0, subtotal - Number(discount));

    // Reservations held by this order — stock already earmarked at confirm.
    const reservedByLine = new Map();
    if (order && ['CONFIRMED', 'PROCESSING', 'READY'].includes(order.status)) {
      for (const item of order.items) {
        const key = `${item.product_id}:${item.batch_id ?? 'bulk'}:${item.warehouse_id ?? get().warehouses[0]?.id}`;
        reservedByLine.set(key, (reservedByLine.get(key) ?? 0) + Number(item.quantity));
      }
    }

    // Validate every line before mutating anything, so one short line cannot
    // leave earlier lines already decremented. Stock reserved for this order
    // counts towards availability — it is released as part of the sale below.
    const requested = new Map();
    for (const item of saleItems) {
      const warehouseId = item.warehouse_id ?? get().warehouses[0]?.id;
      const key = `${item.product_id}:${item.batch_id ?? 'bulk'}:${warehouseId}`;
      const prev = requested.get(key);
      requested.set(key, { ...item, warehouse_id: warehouseId, quantity: (prev?.quantity ?? 0) + Number(item.quantity) });
    }
    for (const req of requested.values()) {
      const stock = get().inventory.find(
        (row) => row.product_id === req.product_id && (row.batch_id ?? null) === (req.batch_id ?? null) && row.warehouse_id === req.warehouse_id
      );
      const reserved = reservedByLine.get(`${req.product_id}:${req.batch_id ?? 'bulk'}:${req.warehouse_id}`) ?? 0;
      if (order && ['CONFIRMED', 'PROCESSING', 'READY'].includes(order.status) && req.quantity > reserved) {
        throw new Error('Delivered quantity cannot exceed the confirmed order quantity');
      }
      if (!stock || availableQty(stock) + reserved < req.quantity) {
        throw new Error('Insufficient available stock to record this sale (§37: negative stock is not allowed)');
      }
    }

    // Decrease stock for every line (§36). For order fulfilment, release the
    // reservation first so the earmarked goods become sellable, then record
    // the sale — reserved_qty is consumed exactly once (never leaked, never
    // double-counted).
    for (const item of saleItems) {
      const warehouseId = item.warehouse_id ?? get().warehouses[0]?.id;
      const key = `${item.product_id}:${item.batch_id ?? 'bulk'}:${warehouseId}`;
      const reserved = reservedByLine.get(key) ?? 0;
      if (reserved > 0) {
        const releaseQty = Math.min(reserved, Number(item.quantity));
        if (releaseQty > 0) {
          get().applyMovement({
            product_id: item.product_id,
            batch_id: item.batch_id ?? null,
            warehouse_id: warehouseId,
            movement_type: 'RELEASE',
            quantity: releaseQty,
            reference_type: 'order',
            reference_id: order_id,
            notes: `Reservation converted to sale${order ? ` ${order.order_number}` : ''}`,
          });
          reservedByLine.set(key, reserved - releaseQty);
        }
      }
      get().applyMovement({
        product_id: item.product_id,
        batch_id: item.batch_id ?? null,
        warehouse_id: warehouseId,
        movement_type: 'SALE',
        quantity: item.quantity,
        reference_type: 'sale',
        notes: notes || 'Sale',
      });
    }

    const sale = {
      id: uid(),
      invoice_number: generateInvoiceNumber(get().sales),
      customer_id,
      order_id,
      items: saleItems,
      subtotal,
      discount: Number(discount),
      total,
      // Carry any prepayment made on the order through to the invoice
      // instead of re-entering it as an UNPAID sale (§23).
      paid_amount: order ? Math.min(Number(order.paid_amount) || 0, total) : 0,
      payment_status: order
        ? paymentStatus(total, Math.min(Number(order.paid_amount) || 0, total))
        : 'UNPAID',
      notes,
      sale_date: new Date().toISOString().slice(0, 10),
      order_number: order?.order_number ?? null,
      created_by: get().profile?.fullName ?? '—',
      created_by_id: get().profile?.id,
      created_at: nowISO(),
    };
    set((s) => ({ sales: [sale, ...s.sales] }));

    // Attach the order's advance to the new invoice so the payment history
    // shows where the money came from (link the existing entry, create one
    // if an order-level advance was recorded without a lien).
    if (order && Number(order.paid_amount) > 0) {
      const advance = Math.min(Number(order.paid_amount) || 0, total);
      const partner = get().payments.find((p) => p.order_id === order.id && !p.sale_id);
      if (partner) {
        set((s) => ({
          payments: s.payments.map((p) => (p.id === partner.id ? { ...p, sale_id: sale.id, order_number: sale.order_number } : p)),
        }));
      } else {
        get().recordPayment({
          sale_id: sale.id,
          order_id: order.id,
          order_number: order.order_number,
          customer_id,
          amount: advance,
          method: 'Advance',
          reference: `Prepayment applied — ${sale.invoice_number}`,
        });
      }
    }

    if (order) {
      // Complete the order directly — COMPLETED is a store-managed terminal
      // state reached via invoicing, not a manual transition.
      get().updateOrder(order.id, { status: 'COMPLETED' });
      get().logAction(`Order ${order.order_number} completed via invoice ${sale.invoice_number}`, 'Orders');
    }
    get().logAction(`Sale ${sale.invoice_number} created (${sale.total} RWF)`, 'Sales');
    get().pushNotification('success', 'Sale recorded', `Invoice ${sale.invoice_number} created.`);
    return sale;
  },

  /** Single write path for payments (advances, invoice payments, refunds). */
  recordPayment({ sale_id = null, order_id = null, order_number = null, customer_id, amount, method, reference = '', payment_date = null, status = 'CONFIRMED' }) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Payment amount must be positive');
    const payment = {
      id: uid(),
      sale_id,
      order_id,
      order_number,
      customer_id,
      amount: amt,
      method,
      reference,
      status,
      payment_date: payment_date || new Date().toISOString().slice(0, 10),
      recorded_by: get().profile?.fullName ?? '—',
      recorded_by_id: get().profile?.id,
      created_at: nowISO(),
    };
    set((s) => ({ payments: [payment, ...s.payments] }));
    return payment;
  },

  /** Record a payment against a sale; recalculates PAID/PARTIAL/UNPAID (§23). */
  addPayment({ sale_id, amount, method, reference = '', payment_date, evidence = null }) {
    const sale = get().sales.find((s) => s.id === sale_id);
    if (!sale) throw new Error('Sale not found');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Payment amount must be positive');
    if (!evidence || !(typeof evidence === 'string' || evidence.data || evidence.url)) {
      throw new Error('Payment evidence is required');
    }
    const previousPaid = Number(sale.paid_amount) || 0;
    const outstanding = Math.max(0, Number(sale.total) - previousPaid);
    if (amt > outstanding) throw new Error('Payment exceeds the remaining invoice balance');
    const paid = previousPaid + amt;

    get().recordPayment({
      sale_id,
      customer_id: sale.customer_id,
      amount: amt,
      method,
      reference,
      payment_date,
      evidence,
    });

    set((s) => ({
      sales: s.sales.map((sa) =>
        sa.id === sale_id
          ? { ...sa, paid_amount: paid, payment_status: paymentStatus(sa.total, paid) }
          : sa
      ),
    }));
    get().logAction(`Payment ${amt} RWF recorded on ${sale.invoice_number}`, 'Payments');
    get().pushNotification('success', 'Payment received', `${amt.toLocaleString()} RWF on invoice ${sale.invoice_number}.`);
  },

  requestPayment({ sale_id, amount, method, reference = '', payment_date, evidence = null }) {
    const sale = get().sales.find((item) => item.id === sale_id);
    if (!sale) throw new Error('Invoice not found');
    const profile = get().profile;
    if (profile?.role !== 'customer' || profile.customer_id !== sale.customer_id) {
      throw new Error('You can only request payment confirmation for your own invoice');
    }
    if (!evidence || !(typeof evidence === 'string' || evidence.data || evidence.url)) {
      throw new Error('Payment evidence is required');
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Payment amount must be positive');
    const paid = Number(sale.paid_amount) || 0;
    const pending = get().payments
      .filter((payment) => payment.sale_id === sale_id && payment.status === 'PENDING')
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const availableToRequest = Math.max(0, Number(sale.total) - paid - pending);
    if (amt > availableToRequest) throw new Error('Payment request exceeds the unconfirmed invoice balance');
    const request = get().recordPayment({
      sale_id,
      order_id: sale.order_id,
      order_number: sale.order_number,
      customer_id: sale.customer_id,
      amount: amt,
      method,
      reference,
      payment_date,
      evidence,
      status: 'PENDING',
    });
    get().logAction(`Payment confirmation requested for ${sale.invoice_number}`, 'Payments');
    get().pushNotification('info', 'Payment awaiting confirmation', `${amt.toLocaleString()} RWF was submitted for ${sale.invoice_number}.`);
    return request;
  },

  confirmPaymentRequest(paymentId) {
    assertPaymentManager(get);
    const payment = get().payments.find((item) => item.id === paymentId);
    if (!payment || payment.status !== 'PENDING') throw new Error('Pending payment request not found');
    const sale = get().sales.find((item) => item.id === payment.sale_id);
    if (!sale) throw new Error('Invoice not found');
    const paid = Number(sale.paid_amount) || 0;
    const amount = Number(payment.amount) || 0;
    if (amount > Math.max(0, Number(sale.total) - paid)) {
      throw new Error('This request now exceeds the invoice balance. Reject it and ask the customer to submit the correct amount.');
    }
    const newPaid = paid + amount;
    set((state) => ({
      payments: state.payments.map((item) => item.id === paymentId
        ? { ...item, status: 'CONFIRMED', confirmed_by: get().profile?.fullName ?? 'Manager', confirmed_by_id: get().profile?.id, confirmed_at: nowISO() }
        : item),
      sales: state.sales.map((item) => item.id === sale.id
        ? { ...item, paid_amount: newPaid, payment_status: paymentStatus(item.total, newPaid) }
        : item),
    }));
    get().logAction(`Confirmed payment of ${amount} RWF for ${sale.invoice_number}`, 'Payments');
    get().pushNotification('success', 'Payment confirmed', `${amount.toLocaleString()} RWF confirmed for ${sale.invoice_number}.`);
  },

  rejectPaymentRequest(paymentId) {
    assertPaymentManager(get);
    const payment = get().payments.find((item) => item.id === paymentId);
    if (!payment || payment.status !== 'PENDING') throw new Error('Pending payment request not found');
    set((state) => ({
      payments: state.payments.map((item) => item.id === paymentId
        ? { ...item, status: 'REJECTED', confirmed_by: get().profile?.fullName ?? 'Manager', confirmed_by_id: get().profile?.id, confirmed_at: nowISO() }
        : item),
    }));
    get().logAction(`Rejected payment request for ${payment.order_number ?? 'invoice'}`, 'Payments');
    get().pushNotification('info', 'Payment request rejected', 'The submitted payment request was rejected.');
  },

  /** Outstanding balance across all sales of a customer. */
  customerOutstanding(customerId) {
    return get()
      .sales.filter((s) => s.customer_id === customerId)
      .reduce((sum, s) => sum + (s.total - (s.paid_amount ?? 0)), 0);
  },
});

function assertPaymentManager(get) {
  const profile = get().profile;
  if (profile?.role !== 'manager' && !(profile?.permissions ?? []).includes('payments.update')) {
    throw new Error('Only a manager can confirm or reject payment requests');
  }
}

function generateOrderNumber(existing = []) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((o) => o.order_number)
    .filter((n) => typeof n === 'string' && n.startsWith(`ORD-${year}-`))
    .map((n) => parseInt(n.split('-')[2], 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `ORD-${year}-${String(next).padStart(3, '0')}`;
}

function generateInvoiceNumber(existing = []) {
  const year = new Date().getFullYear();
  const nums = existing
    .map((s) => s.invoice_number)
    .filter((n) => typeof n === 'string' && n.startsWith(`INV-${year}-`))
    .map((n) => parseInt(n.split('-')[2], 10))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `INV-${year}-${String(next).padStart(4, '0')}`;
}
