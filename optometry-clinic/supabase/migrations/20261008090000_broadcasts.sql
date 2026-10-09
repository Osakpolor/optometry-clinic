-- =====================================================================
-- Broadcasts module — Phase 1 schema
-- Olu Eye Clinic EMR  ·  branch feature/broadcasts  ·  2026-10-08
--
-- Adds the WhatsApp Broadcast / Campaigns data model:
--   * clinics                  multi-tenant anchor (one row for Olu now)
--   * broadcasts               one campaign
--   * broadcast_recipients     per-patient queue AND delivery log
--   * patients.marketing_opted_out[/_at]   mandatory marketing opt-out
--   * broadcast-media bucket    public storage for header images
--                               (public so Meta can fetch the image by URL)
--
-- Non-negotiables honoured (see CLAUDE.md + docs/DATABASE.md):
--   * RLS is enabled on every new table, with an admin-only read policy.
--     All writes go through the service-role client, which bypasses RLS,
--     so there are intentionally NO insert/update policies here.
--   * Fully idempotent: safe to run twice, or to re-run after a partial
--     failure (if not exists / on conflict / drop policy if exists).
--   * Additive only. Nothing is dropped; no existing row is rewritten.
--
-- Scope note: send-now MVP. The `scheduled_at` column and the 'scheduled'
-- status value are included (harmless, nullable/enum) so the later
-- scheduling phase needs no further migration, but nothing in the
-- send-now MVP writes them.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. clinics  (SaaS tenant anchor — one row for Olu in v1)
-- ---------------------------------------------------------------------
create table if not exists clinics (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  wa_phone_number_id text,          -- nullable, unused in v1 (per-tenant creds come later)
  wa_waba_id         text,
  messaging_tier     text,
  created_at         timestamptz not null default now()
);

-- Seed the single Olu row (idempotent: only inserts if absent).
insert into clinics (name)
select 'Olu Eye Clinic'
where not exists (select 1 from clinics where name = 'Olu Eye Clinic');


-- ---------------------------------------------------------------------
-- 2. broadcasts  (one campaign)
-- ---------------------------------------------------------------------
create table if not exists broadcasts (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid references clinics(id),
  title            text not null,
  template_name    text not null,
  language         text not null default 'en',
  header_image_url text,                                   -- public broadcast-media URL
  body_params      jsonb not null default '[]'::jsonb,     -- ordered {{1}},{{2}}… values
  button_url       text,                                   -- dynamic URL-button value, if any
  audience_filter  jsonb not null default '{}'::jsonb,
  status           text not null default 'draft'
                     check (status in ('draft','scheduled','sending','sent','failed')),
  scheduled_at     timestamptz,                            -- unused in send-now MVP
  total_count      int not null default 0,
  sent_count       int not null default 0,
  delivered_count  int not null default 0,
  read_count       int not null default 0,
  failed_count     int not null default 0,
  capped_count     int not null default 0,
  created_by       uuid references staff_profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3. broadcast_recipients  (the queue AND the per-recipient delivery log)
-- ---------------------------------------------------------------------
create table if not exists broadcast_recipients (
  id            uuid primary key default gen_random_uuid(),
  broadcast_id  uuid not null references broadcasts(id) on delete cascade,
  patient_id    uuid references patients(id) on delete set null,  -- keep the log if a patient is deleted
  phone         text not null,
  status        text not null default 'queued'
                  check (status in ('queued','sent','delivered','read','failed','skipped','capped')),
  wa_message_id text,                                     -- Meta message id, for status-webhook matching
  error         text,
  sent_at       timestamptz,
  updated_at    timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
-- Drain endpoint pulls queued rows per broadcast; webhook matches by message id.
create index if not exists broadcast_recipients_broadcast_status_idx
  on broadcast_recipients (broadcast_id, status);

create index if not exists broadcast_recipients_wa_message_id_idx
  on broadcast_recipients (wa_message_id);

-- Helps the drain endpoint find broadcasts that are currently 'sending'.
create index if not exists broadcasts_status_idx
  on broadcasts (status);


-- ---------------------------------------------------------------------
-- 5. patients — mandatory marketing opt-out
-- ---------------------------------------------------------------------
alter table patients
  add column if not exists marketing_opted_out boolean not null default false;

alter table patients
  add column if not exists marketing_opted_out_at timestamptz;


-- ---------------------------------------------------------------------
-- 6. Row Level Security
--    New tables are reached two ways:
--      * server-side via the service-role client (enqueue, drain, webhook)
--        — service-role BYPASSES RLS, so no write policy is needed;
--      * admin dashboard pages via the user session client — allowed below.
--    No policy for non-admins ⇒ they see zero rows, by design.
-- ---------------------------------------------------------------------
alter table clinics              enable row level security;
alter table broadcasts           enable row level security;
alter table broadcast_recipients enable row level security;

drop policy if exists clinics_admin_read on clinics;
create policy clinics_admin_read on clinics
  for select to authenticated
  using (exists (select 1 from staff_profiles sp
                 where sp.id = auth.uid() and sp.role = 'admin'));

drop policy if exists broadcasts_admin_read on broadcasts;
create policy broadcasts_admin_read on broadcasts
  for select to authenticated
  using (exists (select 1 from staff_profiles sp
                 where sp.id = auth.uid() and sp.role = 'admin'));

drop policy if exists broadcast_recipients_admin_read on broadcast_recipients;
create policy broadcast_recipients_admin_read on broadcast_recipients
  for select to authenticated
  using (exists (select 1 from staff_profiles sp
                 where sp.id = auth.uid() and sp.role = 'admin'));


-- ---------------------------------------------------------------------
-- 7. Storage — public bucket for uploaded header images
--    Public so Meta's servers can fetch the image by URL at send time.
--    Public read is served through the storage /public/ path and needs no
--    policy; only admins may upload/replace/delete objects.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('broadcast-media', 'broadcast-media', true, 5242880, array['image/jpeg','image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists broadcast_media_admin_insert on storage.objects;
create policy broadcast_media_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'broadcast-media'
    and exists (select 1 from staff_profiles sp
                where sp.id = auth.uid() and sp.role = 'admin')
  );

drop policy if exists broadcast_media_admin_update on storage.objects;
create policy broadcast_media_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'broadcast-media'
    and exists (select 1 from staff_profiles sp
                where sp.id = auth.uid() and sp.role = 'admin')
  );

drop policy if exists broadcast_media_admin_delete on storage.objects;
create policy broadcast_media_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'broadcast-media'
    and exists (select 1 from staff_profiles sp
                where sp.id = auth.uid() and sp.role = 'admin')
  );

-- =====================================================================
-- End of Phase 1 migration.
-- =====================================================================
