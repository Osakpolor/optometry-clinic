import { loadClinicPrompt } from './prompt-loader'

type ReplyContext = {
  fromNumber: string
  messageText: string
  patient: {
    id: string
    full_name: string
    phone: string
    date_of_birth?: string
  } | null
  lead: {
    id: string
    full_name: string
    phone: string
    service_interest?: string
    status?: string
    preferred_date?: string
    preferred_time?: string
  } | null
  recentVisit: {
    visit_date: string
    diagnosis?: string
    medications?: any[]
    follow_up_date?: string
    refraction?: any
    notes?: string
  } | null
  allVisits: {
    visit_date: string
    diagnosis?: string
    medications?: any[]
    follow_up_date?: string
    refraction?: any
    notes?: string
  }[]
  conversationHistory: {
    role: string
    message: string
    created_at: string
  }[]
  // Upcoming confirmed appointments (booked/confirmed status)
  upcomingAppointments: {
    appointment_date: string
    service_type: string | null
    status: string
  }[]
  // Most recent rebook request for this patient (pending or approved)
  pendingRebook: {
    requested_date: string | null
    requested_time: string | null
    status: string
  } | null
}

export type BookingResult = {
  name: string
  phone: string
  date: string
  time: string
  service: string
} | null

export type RebookResult = {
  patient_name: string
  phone: string
  requested_date: string
  requested_time: string
  service?: string
  notes?: string
} | null

export type AppointmentCancelResult = {
  phone: string
  appointment_date?: string
  reason?: string
} | null

export async function generateClaudeReply(ctx: ReplyContext): Promise<{
  reply: string
  booking: BookingResult
  rebook: RebookResult
  appointment_cancelled: AppointmentCancelResult
}> {
  const { messageText, patient, lead, allVisits, conversationHistory, upcomingAppointments, pendingRebook } = ctx

  // ── Build patient context string ─────────────────────────
  let patientContext = ''

  if (patient) {
    patientContext = `
PATIENT RECORD:
- Name: ${patient.full_name}
- Date of birth: ${patient.date_of_birth ?? 'not on file'}
- Known patient: Yes (registered in our system)
- IMPORTANT: You already know this patient's name. Do NOT ask for their name.`

    // ── Upcoming appointments ────────────────────────────────
    if (upcomingAppointments && upcomingAppointments.length > 0) {
      patientContext += `\n\nUPCOMING APPOINTMENTS:`
      upcomingAppointments.forEach(appt => {
        const apptDate = new Date(appt.appointment_date).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
        const apptTime = new Date(appt.appointment_date).toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', hour12: true
        })
        patientContext += `\n- ${apptDate} at ${apptTime} — ${appt.service_type ?? 'appointment'} (${appt.status})`
      })
    } else {
      patientContext += `\n\nUPCOMING APPOINTMENTS: None currently booked.`
    }

    // ── Rebook request status ────────────────────────────────
    if (pendingRebook) {
      if (pendingRebook.status === 'approved') {
        const rebookDate = pendingRebook.requested_date
          ? new Date(pendingRebook.requested_date).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })
          : 'a date to be confirmed'
        patientContext += `\n\nREBOOKING STATUS: This patient previously had a rescheduling request that was APPROVED for ${rebookDate}${pendingRebook.requested_time ? ` at ${pendingRebook.requested_time}` : ''}. If the patient is asking about that appointment, confirm it was approved. HOWEVER — if the patient now wants to reschedule to a DIFFERENT date, accept the new request normally and emit a [REBOOK_REQUEST] block with the new date. Patients are allowed to change their appointment as many times as they need.`
      } else if (pendingRebook.status === 'pending') {
        const rebookDate = pendingRebook.requested_date
          ? new Date(pendingRebook.requested_date).toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })
          : 'a date to be confirmed'
        patientContext += `\n\nREBOOKING STATUS: This patient has a PENDING rescheduling request for ${rebookDate} that our team hasn't confirmed yet. If the patient is asking about its status, tell them it's still being processed. HOWEVER — if the patient now wants to change to a DIFFERENT date, accept the new date and emit a [REBOOK_REQUEST] block with the updated date. This will replace the previous pending request. Patients are allowed to change their appointment as many times as they need.`
      }
    }

    if (allVisits && allVisits.length > 0) {
      patientContext += `\n\nVISIT HISTORY (most recent first):`

      allVisits.forEach((visit, i) => {
        const meds = visit.medications?.filter((m: any) => m.name) ?? []
        const visitDate = new Date(visit.visit_date).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric'
        })

        patientContext += `

Visit ${i + 1} (${visitDate}):
- Diagnosis: ${visit.diagnosis ?? 'not recorded'}
- Prescribed medications: ${meds.length > 0
          ? meds.map((m: any) => `${m.name} ${m.freq ?? ''}`).join(', ')
          : 'none'}
- Doctor's notes: ${visit.notes ?? 'none'}
- Follow-up scheduled: ${visit.follow_up_date ?? 'none'}`
      })
    }
  } else if (lead) {
    patientContext = `
LEAD RECORD:
- Name: ${lead.full_name}
- Service interest: ${lead.service_interest ?? 'not specified'}
- Booking status: ${lead.status ?? 'new'}
- Preferred date: ${lead.preferred_date ?? 'not specified'}
- Preferred time: ${lead.preferred_time ?? 'not specified'}
- Known patient: No (has not visited yet)`
  } else {
    patientContext = `
UNKNOWN CONTACT:
- This number is not in the patient database
- Treat as a new enquiry`
  }

  // ── Determine session context ────────────────────────────
  const todayWAT = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10)
  const hasAnyHistory = conversationHistory.length > 0
  const hasTodayHistory = conversationHistory.some(h => h.created_at.startsWith(todayWAT))
  const isFirstEverContact = !hasAnyHistory
  const isFirstToday = hasAnyHistory && !hasTodayHistory

  // Nigeria time (WAT = UTC+1)
  const now = new Date()
  const watOffset = 60 * 60 * 1000
  const watNow = new Date(now.getTime() + watOffset)
  const hour = watNow.getUTCHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  // ── Inject real current date ─────────────────────────────
  const currentDate = watNow.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC', // already adjusted above
  })

  const patientName = patient?.full_name ?? lead?.full_name ?? ''

  // ── Is this a known patient (drives rebook vs lead routing) ──
  const isKnownPatient = patient !== null

  // ── Load system prompt from markdown file ────────────────
  const systemPrompt = await loadClinicPrompt('olu-eye-clinic', {
    clinic_name: 'Olu Eye Clinic',
    clinic_address: '158 Airport Road, Ogogugbo, Benin City 300251, Edo State',
    clinic_phone: '+234 9166015438',
    clinic_services: 'Eye exams, glasses fitting, contact lens fitting, follow-up visits',
    clinic_hours: 'Monday–Saturday, 8am–4pm',
    patient_context: patientContext,
    is_first_ever_contact: isFirstEverContact ? 'true' : 'false',
    is_first_today: isFirstToday ? 'true' : 'false',
    time_of_day: timeOfDay,
    patient_name: patientName,
    current_date: currentDate,
    is_known_patient: isKnownPatient ? 'true' : 'false',
  })

  // ── Build conversation history for Claude ────────────────
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...conversationHistory.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.message,
    })),
    {
      role: 'user' as const,
      content: messageText,
    }
  ]

  // ── Call Claude API ──────────────────────────────────────
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Claude API error:', data)
    return {
      reply: `Sorry, we're experiencing a brief issue. Please call us on 09166015438 or try again in a moment.`,
      booking: null,
      rebook: null,
      appointment_cancelled: null,
    }
  }

  const fullReply = data.content?.[0]?.text ?? `Thank you for your message. We'll be in touch shortly.`

  // ── Extract structured blocks ────────────────────────────
  const booking = isKnownPatient ? null : extractBookingFromReply(fullReply)
  const rebook = isKnownPatient ? extractRebookFromReply(fullReply) : null
  const appointment_cancelled = extractCancellationFromReply(fullReply)

  // Strip all hidden blocks from the reply sent to the patient
  const cleanReply = fullReply
    .replace(/\[BOOKING_CONFIRMED\][\s\S]*?\[\/BOOKING_CONFIRMED\]/g, '')
    .replace(/\[REBOOK_REQUEST\][\s\S]*?\[\/REBOOK_REQUEST\]/g, '')
    .replace(/\[APPOINTMENT_CANCELLED\][\s\S]*?\[\/APPOINTMENT_CANCELLED\]/g, '')
    .trim()

  return {
    reply: cleanReply,
    booking,
    rebook,
    appointment_cancelled,
  }
}

// ── Extractors ───────────────────────────────────────────────

export function extractBookingFromReply(fullReply: string): BookingResult {
  const match = fullReply.match(/\[BOOKING_CONFIRMED\]([\s\S]*?)\[\/BOOKING_CONFIRMED\]/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export function extractRebookFromReply(fullReply: string): RebookResult {
  const match = fullReply.match(/\[REBOOK_REQUEST\]([\s\S]*?)\[\/REBOOK_REQUEST\]/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export function extractCancellationFromReply(fullReply: string): AppointmentCancelResult {
  const match = fullReply.match(/\[APPOINTMENT_CANCELLED\]([\s\S]*?)\[\/APPOINTMENT_CANCELLED\]/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}