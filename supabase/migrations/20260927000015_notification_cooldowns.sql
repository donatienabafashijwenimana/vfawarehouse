-- Rate-limit the low-stock notification to one digest a week.
--
-- checkLowStock() used to raise one notification per product, and its only dedup was
-- a title match against the notifications still in the store. That made it fire on
-- every page load and after every sale, damage, adjustment or transfer, and — now
-- that notifications can be deleted — deleting the alert brought it straight back
-- on the next stock movement, which is the opposite of clearing it.
--
-- A cooldown has to outlive the notification it governs. Deriving it from the
-- notifications table cannot work, because the whole point is that the operator is
-- able to delete the row; and the settings table is a single jsonb blob that only a
-- manager may read, so it cannot hold a per-user timestamp. Hence its own table.
--
-- One row per user per alert kind, so this generalises if another repeating alert
-- needs a different interval. RLS keeps it to the signed-in user's own rows, and
-- ON DELETE CASCADE clears them when the account goes.

create table if not exists notification_cooldowns (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  last_raised_at timestamptz not null default now(),
  primary key (user_id, key)
);

comment on table notification_cooldowns is
  'Last time each repeating alert was raised, so it can be rate-limited independently of whether the notification was read or deleted.';

alter table notification_cooldowns enable row level security;

drop policy if exists cooldown_select on notification_cooldowns;
create policy cooldown_select on notification_cooldowns for select using (user_id = auth.uid());

drop policy if exists cooldown_insert on notification_cooldowns;
create policy cooldown_insert on notification_cooldowns for insert with check (user_id = auth.uid());

drop policy if exists cooldown_update on notification_cooldowns;
create policy cooldown_update on notification_cooldowns for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists cooldown_delete on notification_cooldowns;
create policy cooldown_delete on notification_cooldowns for delete using (user_id = auth.uid());

-- Decide whether an alert may be raised now, and record that it was, in one round
-- trip. Two requests would be needed otherwise (select, then upsert) on a path that
-- runs after every stock movement, leaving a window where two tabs both read "not
-- raised yet" and both raise the digest.
--
-- Returns true when the caller should raise the alert. The timestamp is stamped as
-- part of deciding, so the week starts when the alert was actually raised rather
-- than when it was next checked.
--
-- The advisory lock serialises the read-then-write against other tabs. Without it
-- the select finds no row, both callers fall through to the insert, and the loser's
-- on-conflict update silently discards the winner's timestamp — so both raise.
create or replace function rpc_notification_cooldown(
  p_key text,
  p_interval_hours integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
begin
  if p_key is null or p_key = '' then
    raise exception 'Cooldown key is required' using errcode = 'check_violation';
  end if;
  if p_interval_hours is null or p_interval_hours <= 0 then
    raise exception 'Cooldown interval must be greater than zero, not %', p_interval_hours
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_key, 0));

  select last_raised_at into v_last
  from notification_cooldowns
  where user_id = auth.uid() and key = p_key;

  if v_last is not null and v_last > now() - make_interval(hours => p_interval_hours) then
    return false;
  end if;

  insert into notification_cooldowns (user_id, key, last_raised_at)
  values (auth.uid(), p_key, now())
  on conflict (user_id, key) do update set last_raised_at = excluded.last_raised_at;

  return true;
end;
$$;
