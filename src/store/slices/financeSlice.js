const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random()}`);
const nowISO = () => new Date().toISOString();

export const EXPENSE_CATEGORIES = [
  'Production costs',
  'Packaging',
  'Transport',
  'Labor',
  'Utilities',
  'Maintenance',
  'Equipment',
  'Other',
];

/** Finance slice (spec §24–25): expenses + income aggregates. */
export const financeSlice = (set, get) => ({
  expenses: [],
  expenseCategoryList: EXPENSE_CATEGORIES,

  addExpense(row) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Expense amount must be positive');
    set((s) => ({
      expenses: [{ ...row, amount, id: uid(), recorded_by: get().profile?.fullName ?? '—', created_at: nowISO() }, ...s.expenses],
    }));
    get().logAction(`Expense recorded: ${row.description} (${amount} RWF)`, 'Expenses');
  },
  updateExpense(id, fields) {
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...fields } : e)) }));
    get().logAction(`Updated expense`, 'Expenses');
  },
  deleteExpense(id) {
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    get().logAction(`Deleted expense`, 'Expenses');
  },

  totalExpenses() {
    return get().expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  },

  totalSalesRevenue() {
    return get().sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  },

  totalPaymentsReceived() {
    return get().payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  },

  outstandingReceivables() {
    return get()
      .sales.reduce((sum, s) => sum + ((Number(s.total) || 0) - (Number(s.paid_amount) || 0)), 0);
  },

  netIncome() {
    return get().totalSalesRevenue() - get().totalExpenses();
  },
});
