// app/api/cron/appointment-reminders/route.ts
//
// Runs ONCE daily (Vercel Hobby plan fires one cron per day). In that
// single pass it handles all three reminder windows, each guarded by its
// own boolean column so a reminder fires exactly once per appointment:
//
//   • Week-before — appointments ~7 days out   (reminder_sent_week_before)
//   • Day-before  — appointments tomorrow       (reminder_sent_day_before)
//   • Day-of      — appointments today          (reminder_sent_day_of)
//
// All three send the same approved template (olu_appointment_reminder);
// the wording is generic enough to suit any lead time.

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendAppointmentReminderTemplate } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service-role client — the cron has no user session, so the normal
  // cookie-based client would be blocked by RLS and return zero rows.
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // UTC day boundaries. Appointment timestamps are stored in UTC.
  const now = new Date()
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0)

  function dayOffset(n: number) {
    const d = new Date(startOfToday)
    d.setUTCDate(d.getUTCDate() + n)
    return d
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  // A window is [start, end) in UTC plus the flag column that guards it.
  const windows = [
    { label: 'week-before', start: dayOffset(7), end: dayOffset(8), flag: 'reminder_sent_week_before' },
    { label: 'day-before',  start: dayOffset(1), end: dayOffset(2), flag: 'reminder_sent_day_before' },
    { label: 'day-of',      start: dayOffset(0), end: dayOffset(1), flag: 'reminder_sent_day_of' },
  ]

  const results: Record<string, number> = {}
  const matched: Record<string, number> = {}
  const errors: string[] = []

  for (const w of windows) {
    const { data: appts, error } = await supabase
      .from('appointments')
      .select(`id, appointment_date, ${w.flag}, patients(full_name, phone)`)
      .gte('appointment_date', w.start.toISOString())
      .lt('appointment_date', w.end.toISOString())
      .eq(w.flag, false)
      .not('status', 'in', '("cancelled","completed")')

    if (error) {
      errors.push(`${w.label} query: ${error.message}`)
      results[w.label] = 0
      matched[w.label] = 0
      continue
    }

    matched[w.label] = appts?.length ?? 0
    let sent = 0

    for (const apt of (appts ?? []) as any[]) {
      const patient = (apt as any).patients
      if (!patient?.phone) continue

      const result = await sendAppointmentReminderTemplate({
        patientPhone: patient.phone,
        patientName: patient.full_name,
        appointmentDate: fmtDate(apt.appointment_date),
      })

      if (result.success) {
        await supabase
          .from('appointments')
          .update({ [w.flag]: true })
          .eq('id', apt.id)
        sent++
      } else {
        errors.push(`${w.label} ${apt.id}: ${result.error}`)
      }
    }

    results[w.label] = sent
  }

  console.log('Reminders sent:', results, 'matched:', matched)
  if (errors.length) console.warn('Reminder errors:', errors)

  return NextResponse.json({
    success: true,
    sent: results,
    matched,
    errors,
  })
}
