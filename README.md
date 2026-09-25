# VFA Irish Potato Seed Production & Warehouse Management System

A production-first management system for VFA (Irish potato seed producer):
**Production → Quality Control → Warehouse → Inventory → Sales → Payments → Reports**.

Built with React + Vite + Tailwind CSS + Zustand + Recharts. Supabase PostgreSQL, Auth,
Row Level Security (RLS), and Storage provide the application data backend.

## Quick start

```bash
cd vfawarehouse
npm install
npm run dev
```

The app requires a configured Supabase project. Without the environment variables below,
it shows the database setup requirement and does not load sample or browser-stored business data.

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of `supabase/schema.sql`.
   This creates the application tables, indexes, RLS policies, and database functions for
   transactional operations such as completing production, creating sales, recording payments,
   and adjusting inventory. It also creates the private archive bucket and metadata table.
3. Copy `.env.example` to `.env` and fill in your project URL + **anon** key:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Restart `npm run dev`. Sign in with a Supabase Auth account; application records are loaded
   from and saved to PostgreSQL. The Zustand store is an in-memory working state only.
5. Create your first manager: register a user, then in Supabase set their profile:
   ```sql
   update profiles set role = 'manager' where email = 'you@vfa.rw';
   ```

### Email notifications

Order creation and status changes, new or updated user accounts, and payment recording or status
changes send transactional email to the affected customer or user. Delivery uses Brevo SMTP from
Supabase Edge Functions. Verify a sender domain in Brevo, generate an SMTP key, then set these
Supabase secrets using your SMTP login and SMTP key (not your API key):

```bash
supabase secrets set BREVO_SMTP_LOGIN=your-smtp-login BREVO_SMTP_KEY=your-smtp-key EMAIL_FROM="VFA Greenhouse Seeds Hub Ltd <notifications@your-domain.rw>"
supabase functions deploy create-managed-user
supabase functions deploy notify-operation
```

Apply the `20260925000001_email_notifications.sql` migration (or rerun `supabase/schema.sql` for a
new project) before enabling notifications. Brevo SMTP credentials and the sender address stay server-side.

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
| System | Notifications, Audit Logs, Archive, Settings, Profile |

The Archive stores supporting files and ZIP copies in the private Supabase Storage bucket.
Payment evidence is required when recording a payment claim and is stored with its payment record.

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
└── store/            # Zustand slices; loaded from Supabase after authentication
supabase/schema.sql   # full database: tables, RLS, RPCs, seed
```
