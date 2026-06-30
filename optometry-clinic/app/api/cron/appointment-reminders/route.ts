import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendAppointmentReminder } from '@/lib/whatsapp'

// This runs automatically every day via Vercel Cron (configured in vercel.json)
export async function GET(req: NextRequest) {
  // Verify this is actually Vercel calling it, not a random visitor
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayAfter = new Date(today)
  dayAfter.setDate(dayAfter.getDate() + 2)

  let remindersSent = 0

  // ── Send "today" reminders ────────────────────────────────
  const { data: todayAppointments } = await supabase
    .from('appointments')
    .select('id, appointment_date, patients(full_name, phone)')
    .gte('appointment_date', today.toISOString())
    .lt('appointment_date', tomorrow.toISOString())
    .not('status', 'in', '("cancelled","completed")')

  for (const apt of todayAppointments ?? []) {
    const patient = (apt as any).patients
    if (!patient?.phone) continue

    let to = patient.phone.replace(/\s+/g, '')
    if (to.startsWith('0')) to = '234' + to.slice(1)
    if (!to.startsWith('234')) to = '234' + to

    const time = new Date(apt.appointment_date).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    })

    try {
      await sendAppointmentReminder({
        to,
        fullName: patient.full_name,
        date: new Date(apt.appointment_date).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long'
        }),
        time,
        isToday: true,
      })
      remindersSent++
    } catch (err) {
      console.error(`Failed to send today reminder to ${to}:`, err)
    }
  }

  // ── Send "tomorrow" reminders ─────────────────────────────
  const { data: tomorrowAppointments } = await supabase
    .from('appointments')
    .select('id, appointment_date, patients(full_name, phone)')
    .gte('appointment_date', tomorrow.toISOString())
    .lt('appointment_date', dayAfter.toISOString())
    .not('status', 'in', '("cancelled","completed")')

  for (const apt of tomorrowAppointments ?? []) {
    const patient = (apt as any).patients
    if (!patient?.phone) continue

    let to = patient.phone.replace(/\s+/g, '')
    if (to.startsWith('0')) to = '234' + to.slice(1)
    if (!to.startsWith('234')) to = '234' + to

    const time = new Date(apt.appointment_date).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    })

    try {
      await sendAppointmentReminder({
        to,
        fullName: patient.full_name,
        date: new Date(apt.appointment_date).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long'
        }),
        time,
        isToday: false,
      })
      remindersSent++
    } catch (err) {
      console.error(`Failed to send tomorrow reminder to ${to}:`, err)
    }
  }

  console.log(`✅ Sent ${remindersSent} appointment reminders`)

  return NextResponse.json({
    success: true,
    remindersSent,
    todayCount: todayAppointments?.length ?? 0,
    tomorrowCount: tomorrowAppointments?.length ?? 0,
  })
}