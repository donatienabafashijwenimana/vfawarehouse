-- Let a user clear their own notifications.
--
-- The table had select, insert and update policies and no delete policy at all, so
-- notifications could be read and marked read but never removed — the list only ever
-- grew, including the low-stock ones checkLowStock() regenerates on every load.
--
-- The rule mirrors notif_insert exactly, because insert and delete are the same
-- authority in reverse: a user may manage notifications addressed to them, and only a
-- manager may manage the ones addressed to nobody.
--
-- A notification with user_id null is a broadcast — it is the same row for every
-- user, not a copy each. Letting any user delete one would remove it for everybody
-- including the manager who raised it, so that half is manager-only. Own
-- notifications are not restricted at all, which is the point of the change.
--
-- RLS is what makes this safe rather than a UI convention: a user who reaches the
-- REST API directly with their own token can delete their own rows and nothing else.

drop policy if exists notif_delete on notifications;

create policy notif_delete on notifications for delete using (
  user_id = auth.uid()
  or (user_id is null and is_manager())
);
