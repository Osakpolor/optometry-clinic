// app/api/cron/appointment-reminders/route.ts
//
// Runs via Vercel Cron. Sends appointment reminders using an approved
// WhatsApp template so they deliver even outside the 24-hour window.
//
// Two reminder windows:
//   • Day-before  — cron at 15:00 UTC (4 PM WAT), for appointments TOMORROW
//   • Day-of      — cron at 06:00 UTC (7 AM WAT), for appointments TODAY
//
// Each window is guarded by a boolean column so a reminder fires exactly
// once per appointment, no matter how often the cron runs.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendAppointmentReminderTemplate } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  // Only Vercel Cron (with the secret) may call this
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // Work out today / tomorrow / day-after boundaries in UTC. The cron
  // fires at fixed UTC times; we compare against the stored appointment
  // timestamps which are also UTC.
  const now = new Date()
  const today = new Date(now)
  today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 2)

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  }

  let dayOfSent = 0
  let dayBeforeSent = 0
  const errors: string[] = []

  // ── Day-of reminders: appointments TODAY, not yet reminded today ──
  const { data: todayAppts } = await supabase
    .from('appointments')
    .select('id, appointment_date, reminder_sent_day_of, patients(full_name, phone)')
    .gte('appointment_date', today.toISOString())
    .lt('appointment_date', tomorrow.toISOString())
    .eq('reminder_sent_day_of', false)
    .not('status', 'in', '("cancelled","completed")')

  for (const apt of todayAppts ?? []) {
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
        .update({ reminder_sent_day_of: true })
        .eq('id', apt.id)
      dayOfSent++
    } else {
      errors.push(`day-of ${apt.id}: ${result.error}`)
    }
  }

  // ── Day-before reminders: appointments TOMORROW, not yet reminded ──
  const { data: tomorrowAppts } = await supabase
    .from('appointments')
    .select('id, appointment_date, reminder_sent_day_before, patients(full_name, phone)')
    .gte('appointment_date', tomorrow.toISOString())
    .lt('appointment_date', dayAfter.toISOString())
    .eq('reminder_sent_day_before', false)
    .not('status', 'in', '("cancelled","completed")')

  for (const apt of tomorrowAppts ?? []) {
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
        .update({ reminder_sent_day_before: true })
        .eq('id', apt.id)
      dayBeforeSent++
    } else {
      errors.push(`day-before ${apt.id}: ${result.error}`)
    }
  }

  console.log(`Reminders sent — day-of: ${dayOfSent}, day-before: ${dayBeforeSent}`)
  if (errors.length) console.warn('Reminder errors:', errors)

  return NextResponse.json({
    success: true,
    dayOfSent,
    dayBeforeSent,
    errors,
  })
}
