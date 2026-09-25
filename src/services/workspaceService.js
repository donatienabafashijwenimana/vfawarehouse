import {
  auditLogsApi, batchesApi, categoriesApi, customersApi, expensesApi, inventoryApi,
  movementsApi, notificationsApi, ordersApi, paymentsApi, productsApi, qualityChecksApi,
  salesApi, seedClassesApi, settingsApi, stagesApi, usersApi, varietiesApi, warehousesApi,
} from './dataService';

export async function loadWorkspaceData() {
  const [users, categories, seedClasses, varieties, products, warehouses, inventory, movements,
    batches, stages, qualityChecks, customers, orders, sales, payments, expenses,
    notifications, auditLogs, settingsResult] = await Promise.all([
    usersApi.list(), categoriesApi.list(), seedClassesApi.list(), varietiesApi.list(), productsApi.list(),
    warehousesApi.list(), inventoryApi.list(), movementsApi.list(), batchesApi.list(), stagesApi.list(),
    qualityChecksApi.list(), customersApi.list(), ordersApi.list(), salesApi.list(), paymentsApi.list(),
    expensesApi.list(), notificationsApi.list(), auditLogsApi.list(), settingsApi.get(),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  const settingsRow = settingsResult.data;
  return {
    users: users.map(mapUser),
    categories,
    seedClasses,
    varieties,
    products,
    warehouses,
    inventory,
    movements: movements.map((row) => ({ ...row, created_by_name: row.created_by_profile?.full_name ?? '' })),
    batches: batches.map((row) => ({ ...row, created_by_name: row.created_by_profile?.full_name ?? '' })),
    stages,
    qualityChecks: qualityChecks.map((row) => ({ ...row, inspector_name: row.inspector_profile?.full_name ?? '' })),
    customers,
    orders: orders.map((row) => ({ ...row, items: row.items ?? [] })),
    sales: sales.map((row) => ({ ...row, order_number: row.order?.order_number ?? null, created_by_name: row.created_by_profile?.full_name ?? '' })),
    payments: payments.map((row) => ({ ...row, order_number: row.order?.order_number ?? row.order_number, evidence: row.evidence_url ? { data: row.evidence_url, name: row.evidence_name ?? 'Payment evidence', type: row.evidence_type ?? '' } : null })),
    expenses: expenses.map((row) => ({ ...row, recorded_by_name: row.recorded_by_profile?.full_name ?? '' })),
    notifications,
    auditLogs: auditLogs.map((row) => ({ ...row, user: row.user_profile?.full_name ?? '' })),
    settings: { ...(settingsRow?.data ?? {}), id: settingsRow?.id ?? null },
  };
}

function mapUser(user) {
  return { ...user, fullName: user.full_name, roleLabel: user.role[0].toUpperCase() + user.role.slice(1), registered: user.registered };
}
