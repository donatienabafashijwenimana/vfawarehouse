# VFA Irish Potato Seed Production & Warehouse Management System

A production-first management system for VFA (Irish potato seed producer):
**Production → Quality Control → Warehouse → Inventory → Sales → Payments → Reports**.

Built with React + Vite + Tailwind CSS + Zustand + Recharts, with Supabase (PostgreSQL,
Auth, RLS) as the backend when configured.

## Quick start

```bash
cd vfawarehouse
npm install
npm run dev
```

The app boots in **demo mode** (no database needed) with realistic seed data.

### Demo accounts (password: `vfa2025`)

| Role | Email | Access |
|---|---|---|
| Manager | manager@vfa.rw | Everything |
| Staff (production) | staff@vfa.rw | Production, QC, inventory, orders |
| Staff (warehouse) | warehouse@vfa.rw | Inventory, warehouses, sales |
| Customer | customer@vfa.rw | Own orders, invoices, payments |

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of `supabase/schema.sql`.
   This creates all tables, RLS policies, RPCs (complete batch, create sale,
   confirm/cancel order, record payment, adjust inventory) and seed reference data.
3. Copy `.env.example` to `.env` and fill in your project URL + **anon** key:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart `npm run dev`. The app detects the keys and switches to live mode.
5. Create your first manager: register a user, then in Supabase set their profile:
   ```sql
   update profiles set role = 'manager' where email = 'you@vfa.rw';
   ```

> ⚠️ Never expose the `service_role` key in the frontend. Only the anon key goes in `.env`,
> and RLS policies protect all data.

## Modules

| Area | Pages |
|---|---|
| Dashboard | Role-aware KPIs + charts (production, sales, quality, inventory) |
| Management | Users, Roles & Permissions, Customers |
| Products | Products, Varieties, Seed Classes |
| Production | Batches (lifecycle + completion → inventory), Batch detail (full traceability), Quality Control |
| Warehouse | Warehouses, Inventory (adjust/transfer/damage), Stock Movements (audit trail) |
| Sales | Orders (reserve → ready → complete / cancel → release), Sales/Invoices, Payments |
| Finance | Income (revenue, receivables, net), Expenses |
| Reports | Production, Inventory, Sales, Financial tabs |
| System | Notifications, Audit Logs, Settings, Profile |

## Business rules enforced (spec §36–37)

- Completing a batch adds **output** to inventory; rejected qty never becomes sellable.
- Confirming an order **reserves** stock; cancelling **releases** it; invoicing a confirmed
  order converts the reservation into a **sale** (stock decreases, reservation is released
  exactly once) and completes the order.
- Selling more than available stock is blocked (negative stock impossible), and every
  sale validates all lines before mutating any inventory row.
- Payment status auto-derives: `PAID` / `PARTIAL` / `UNPAID` from paid vs total.
- Every inventory change writes a **stock movement** (user, date, product, batch, reference).
- Customers see **only their own** orders, invoices, and payments (frontend + RLS).

## Structure

```
src/
├── components/       # Layout, Sidebar (permission-aware), ProtectedRoute, ui/
├── hooks/            # usePermissions, useAction
├── lib/              # permissions, calc (business rules), format
├── pages/            # auth/ dashboard/ users/ catalog/ production/ warehouse/
│                     # sales/ finance/ reports/ system/ portal/ (lazy-loaded per route)
├── services/         # supabase client, auth service, data facade
└── store/            # Zustand slices + demo data
supabase/schema.sql   # full database: tables, RLS, RPCs, seed
```
