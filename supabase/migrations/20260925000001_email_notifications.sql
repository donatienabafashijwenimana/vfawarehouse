create table if not exists public.email_notification_events (
  event_key text primary key,
  recipient text not null,
  provider_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.email_notification_events enable row level security;
revoke all on public.email_notification_events from anon, authenticated;
grant all on public.email_notification_events to service_role;
