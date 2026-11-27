-- =====================================================================
-- Message health — Phase A schema
-- Olu Eye Clinic EMR  ·  branch feature/message-health  ·  2026-11-26
--
-- WHY THIS EXISTS
--   From ~Oct 10 to Nov 26 the WhatsApp account was billing-restricted.
--   Meta ACCEPTED every send (the app showed "sent") but delivered almost
--   nothing, and nobody knew for ~6 weeks. The gap: delivery receipts for
--   NON-broadcast sends were discarded in the webhook. This migration adds
--   the table that records every non-broadcast send and the final delivery
--   outcome (delivered / read / failed) so that silence is visible.
--
-- SCOPE
--   * message_log                 one row per non-broadcast WhatsApp send
--   * whatsapp_conversations.wa_message_id   ties a thread line to its receipt
--   Broadcasts are deliberately NOT logged here — they already have full
--   per-recipient tracking in broadcast_recipients. A given wa_message_id
--   therefore lives in exactly ONE of the two tables.
--
-- NON-NEGOTIABLES HONOURED (see CLAUDE.md + the broadcasts migration):
--   * RLS enabled, admin-only READ. All writes go through the service-role
--     client (webhook + senders), which BYPASSES RLS, so there are
--     intentionally NO insert/update policies.
--   * Fully idempotent: safe to run twice (if not exists / drop policy if
--     exists). Additive only — nothing dropped, no existing row rewritten.
--
-- ONE DATABASE: preview and production share this single Supabase project,
-- so this file is run ONCE. The code that reads/writes message_log is merged
-- only after this has been applied.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. message_log  (one row per non-broadcast send)
--
--    status lifecycle, forward-only, set by the webhook from Meta receipts:
--        accepted → sent → delivered → read
--    'failed' is terminal and is only entered from a not-yet-delivered state
--    (a message already delivered/read has reached the handset).
--
--    wa_message_id is UNIQUE but NULLABLE: a send that failed at the API call
--    has no Meta id, and Postgres allows many NULLs in a unique column, so
--    every failed-on-send row coexists happily.
-- ---------------------------------------------------------------------
create table if not exists message_log (
  id                uuid primary key default gen_random_uuid(),
  wa_message_id     text unique,                         -- Meta message id; NULL if the API call itself failed
  phone             text not null,                       -- canonical local form via normalizePhone() (e.g. 8012345678)
  patient_id        uuid references patients(id) on delete set null,
  kind              text not null default 'other'
                      check (kind in ('thankyou','reminder','summary','booking','manual','iris','other')),
  template_name     text,                                -- approved template name, or NULL for free-form text
  status            text not null default 'accepted'
                      check (status in ('accepted','sent','delivered','read','failed')),
  error_code        int,                                 -- Meta error code (on failure)
  error_title       text,
  error_details     text,
  created_at        timestamptz not null default now(),
  status_updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. Indexes
--    * created_at — the daily health check scans a 26h→2h window.
--    * status     — health card counts by status over the last 24h.
--    (wa_message_id already has a unique index from the constraint above,
--     which the webhook uses to match receipts.)
-- ---------------------------------------------------------------------
create index if not exists message_log_created_at_idx on message_log (created_at desc);
create index if not exists message_log_status_idx     on message_log (status);


-- ---------------------------------------------------------------------
-- 3. whatsapp_conversations — tie a thread line to its delivery receipt
--    The outgoing bubble in the Conversations inbox shows Sent/Delivered/
--    Read/Failed by joining this column to message_log.wa_message_id.
--    Nullable: older rows and inbound (patient) messages simply have none.
-- ---------------------------------------------------------------------
alter table whatsapp_conversations
  add column if not exists wa_message_id text;

create index if not exists whatsapp_conversations_wa_message_id_idx
  on whatsapp_conversations (wa_message_id);


-- ---------------------------------------------------------------------
-- 4. Row Level Security
--    Reached two ways:
--      * server-side via the service-role client (senders + webhook) —
--        service-role BYPASSES RLS, so no write policy is needed;
--      * admin dashboard reads via the user-session client — allowed below.
--    No policy for non-admins ⇒ they read zero rows, by design. (The inbox
--    status line reads message_log through the service-role client instead,
--    so receptionists still see delivery status without a read policy.)
-- ---------------------------------------------------------------------
alter table message_log enable row level security;

drop policy if exists message_log_admin_read on message_log;
create policy message_log_admin_read on message_log
  for select to authenticated
  using (exists (select 1 from staff_profiles sp
                 where sp.id = auth.uid() and sp.role = 'admin'));

-- =====================================================================
-- End of Phase A migration.
-- =====================================================================
