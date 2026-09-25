import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useStore } from './store/useStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Spinner } from './components/ui/primitives';

// Pages are lazy-loaded so each route becomes its own chunk; this keeps the
// initial bundle small (recharts alone is a large part of the old 1 MB chunk).
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Users = lazy(() => import('./pages/users/Users'));
const Roles = lazy(() => import('./pages/users/Roles'));
const Customers = lazy(() => import('./pages/customers/Customers'));

const Products = lazy(() => import('./pages/catalog/Products'));
const Varieties = lazy(() => import('./pages/catalog/Varieties'));
const SeedClasses = lazy(() => import('./pages/catalog/SeedClasses'));

const Production = lazy(() => import('./pages/production/Production'));
const BatchDetail = lazy(() => import('./pages/production/BatchDetail'));
const Quality = lazy(() => import('./pages/production/Quality'));

const Warehouses = lazy(() => import('./pages/warehouse/Warehouses'));
const Inventory = lazy(() => import('./pages/warehouse/Inventory'));
const InventoryReport = lazy(() => import('./pages/warehouse/InventoryReport'));
const StockMovements = lazy(() => import('./pages/warehouse/StockMovements'));
const InventorySubview = lazy(() => import('./pages/warehouse/InventorySubview'));

const Orders = lazy(() => import('./pages/sales/Orders'));
const Sales = lazy(() => import('./pages/sales/Sales'));
const Payments = lazy(() => import('./pages/sales/Payments'));

const Income = lazy(() => import('./pages/finance/Income'));
const Expenses = lazy(() => import('./pages/finance/Expenses'));

const Reports = lazy(() => import('./pages/reports/Reports'));

const Notifications = lazy(() => import('./pages/system/Notifications'));
const AuditLogs = lazy(() => import('./pages/system/AuditLogs'));
const Settings = lazy(() => import('./pages/system/Settings'));
const Profile = lazy(() => import('./pages/system/Settings').then((m) => ({ default: m.Profile })));
const Archive = lazy(() => import('./pages/system/Archive'));

const PortalProducts = lazy(() => import('./pages/portal/PortalProducts'));

function InventorySubviewRoute() {
  const { view } = useParams();
  return <InventorySubview view={view} />;
}

function PageLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* App shell */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/app" element={<Dashboard />} />

            {/* Management — manager/staff only */}
            <Route element={<ProtectedRoute permission="users.view" />}>
              <Route path="/app/users" element={<Users />} />
              <Route path="/app/roles" element={<Roles />} />
            </Route>
            <Route element={<ProtectedRoute permission="customers.view" />}>
              <Route path="/app/customers" element={<Customers />} />
            </Route>

            {/* Catalog */}
            <Route element={<ProtectedRoute permission="products.view" />}>
              <Route path="/app/products" element={<Products />} />
              <Route path="/app/varieties" element={<Varieties />} />
              <Route path="/app/seed-classes" element={<SeedClasses />} />
            </Route>

            {/* Production */}
            <Route element={<ProtectedRoute permission="production.view" />}>
              <Route path="/app/production" element={<Production />} />
              <Route path="/app/production/:id" element={<BatchDetail />} />
              <Route path="/app/quality" element={<Quality />} />
            </Route>

            {/* Warehouse */}
            <Route element={<ProtectedRoute permission="inventory.view" />}>
              <Route path="/app/warehouses" element={<Warehouses />} />
              <Route path="/app/inventory" element={<Inventory />} />
              <Route path="/app/inventory-report" element={<InventoryReport />} />
              <Route path="/app/inventory/:view" element={<InventorySubviewRoute />} />
              <Route path="/app/stock-movements" element={<StockMovements />} />
            </Route>

            {/* Sales */}
            <Route element={<ProtectedRoute permission="orders.view" />}>
              <Route path="/app/orders" element={<Orders />} />
            </Route>
            <Route element={<ProtectedRoute permission="sales.view" />}>
              <Route path="/app/sales" element={<Sales />} />
            </Route>
            <Route element={<ProtectedRoute permission="payments.view" />}>
              <Route path="/app/payments" element={<Payments />} />
            </Route>

            {/* Finance + Reports — manager/authorized staff */}
            <Route element={<ProtectedRoute permission="reports.view" />}>
              <Route path="/app/income" element={<Income />} />
              <Route path="/app/reports" element={<Reports />} />
            </Route>
            <Route element={<ProtectedRoute permission="expenses.view" />}>
              <Route path="/app/expenses" element={<Expenses />} />
            </Route>

            {/* System */}
            <Route path="/app/notifications" element={<Notifications />} />
            <Route path="/app/profile" element={<Profile />} />
            <Route element={<ProtectedRoute permission="archive.view" />}>
              <Route path="/app/archive" element={<Archive />} />
            </Route>
            <Route element={<ProtectedRoute permission="audit_logs.view" />}>
              <Route path="/app/audit-logs" element={<AuditLogs />} />
            </Route>
            <Route element={<ProtectedRoute permission="settings.manage" />}>
              <Route path="/app/settings" element={<Settings />} />
            </Route>

            {/* Customer portal */}
            <Route element={<ProtectedRoute />}>
              <Route path="/app/portal/products" element={<PortalProducts />} />
            </Route>

            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
