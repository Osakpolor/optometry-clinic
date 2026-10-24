# Scheduling overhaul — implementation brief

## Context
Olu Eye Clinic EMR, live production. This overhaul merges Appointments +
Rebooking into one professional "Scheduling" hub, fixes a broken Book
button on patient files, and adds a calendar view. Visual target: the
"Scheduling hub" prototype (teal #0d7b5f, serif headings, shadow-as-border
cards, 6px radius, status/occupancy color system described per phase).

IMPORTANT: this clinic is a walk-in practice. There are NO time slots.
Scheduling is DAY-LEVEL only — a patient is booked for a DAY, not a time.
Do not build time-of-day pickers.

Branch discipline: this is on `feature/scheduling-overhaul`. Never commit
to main. Build Phase 1, then STOP for preview testing. Do not start
Phases 2–4 until I say so.

---

## Phase 1 (build this now, then stop)

**Goal: fix the Book button + add a patient-file slide-over for managing
appointments.**

1. **Fix the broken Book button.** On the patient file
   (`app/dashboard/patients/[id]/page.tsx`), the current "Book" button
   routes to the PUBLIC lead form (`/book`), which is wrong — it creates a
   LEAD, not an appointment for this existing patient. Replace it with a
   button that opens a slide-over (overlay panel, not a new page) scoped to
   THIS patient.

2. **Patient-file slide-over** — an overlay panel (like the prototype's
   `#sheet`) that lets staff:
   - Book a new appointment for this patient (pick a DATE only + optional
     reason). Writes to `appointments` with `patient_id` set.
   - Reschedule an existing appointment (change the date).
   - Cancel an appointment (sets status to cancelled).
   - It must be scoped to the open patient — no patient-search inside it.

3. **Keep the Visit history** on the patient file exactly as it is now
   (dated clinical visit entries). The slide-over is for APPOINTMENTS only;
   it must not touch, hide, or replace the Visit history card.

4. **Guards + audit (non-negotiable, clinical product):**
   - Server-side role guard on any booking/reschedule/cancel action — not
     just a hidden button. Reuse the `canManage*` helpers in
     `lib/auth/roles.ts`; add one if none fits.
   - Cancellations (destructive) must write to `audit_log`: who, what, when.

5. Match the prototype's styling: status pills (booked / confirmed /
   cancelled / pending), teal accent, slide-over as a right-side overlay.

**STOP after Phase 1. Push the branch, I'll test on the Vercel preview.**

---

## Phase 2 (do NOT build yet — for scope awareness only)

Merge Appointments + Rebooking into one "Scheduling hub" page: 3 summary
tiles (Today / Upcoming / Pending), a List/Calendar segmented switch,
filter tabs (Pending / Today / Upcoming), pending rebook-request cards with
Approve & reschedule / Decline, and appointment rows with Reschedule /
Cancel / Confirm.

## Phase 3 (do NOT build yet)

Calendar view — month grid, DAY-LEVEL occupancy heat colors:
open = green (1–5), filling = amber (6–10), full = red (11+), Sundays
"Closed", today ringed. Thresholds must be easy to tune in one place
(constants), since they're a guess until the clinic sees real volume.
Click a day → day-detail panel listing that day's appointments +
"Book on this day".

## Phase 4 (do NOT build yet)

Reschedule → auto-reminder sync: when an appointment's date changes, the
daily reminder cron (`app/api/cron/appointment-reminders/route.ts`) must
fire for the NEW date, and the per-appointment "already reminded" boolean
must reset so the patient gets a reminder for the new date. Verify a
reschedule doesn't leave a stale reminder flag that suppresses the new one.

---

🤖 Brief authored with Claude (advisor); implementation by Claude Code.
