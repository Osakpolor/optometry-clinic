-- 20261121000000_patient_name_parts.sql
-- Add structured name columns to patients.
--
-- WHY: full_name is a single blob, so a WhatsApp greeting cannot know name
-- order. Legacy records entered surname-first (e.g. "Omoregie Osakpolor", where
-- Omoregie is the SURNAME) were being greeted "Dear Omoregie". New registrations
-- already collect First/Last separately, so storing them gives us a reliable
-- first name for greetings going forward.
--
-- DISCRIMINATOR: first_name IS NULL  ->  unstructured / legacy  ->  greet with
-- the full name (never a guessed token). first_name present -> greet by it.
--
-- SAFE & ADDITIVE: nullable columns, NO backfill. We deliberately do NOT split
-- existing full_name values, because the order is unknowable. Existing rows keep
-- NULL parts and fall back to the full-name greeting.

alter table public.patients
  add column if not exists first_name  text,
  add column if not exists last_name   text,
  add column if not exists other_names text;
