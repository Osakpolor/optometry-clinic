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
  } | null
  conversationHistory: {
    role: string
    message: string
    created_at: string
  }[]
}

export async function generateClaudeReply(ctx: ReplyContext): Promise<string> {
  const { messageText, patient, lead, recentVisit, conversationHistory } = ctx

  // ── Build patient context string ─────────────────────────
  let patientContext = ''

  if (patient) {
    patientContext = `
PATIENT RECORD:
- Name: ${patient.full_name}
- Date of birth: ${patient.date_of_birth ?? 'not on file'}
- Known patient: Yes`

    if (recentVisit) {
      const meds = recentVisit.medications?.filter((m: any) => m.name) ?? []
      patientContext += `

MOST RECENT VISIT (${new Date(recentVisit.visit_date).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      })}):
- Diagnosis: ${recentVisit.diagnosis ?? 'not recorded'}
- Medications prescribed: ${meds.length > 0
        ? meds.map((m: any) => `${m.name} ${m.freq ?? ''}`).join(', ')
        : 'none'}
- Follow-up due: ${recentVisit.follow_up_date ?? 'none scheduled'}`
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
  const isFirstMessage = conversationHistory.length === 0

  // Nigeria time (WAT = UTC+1)
  const now = new Date()
  const hour = new Date(now.getTime() + 60 * 60 * 1000).getUTCHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  const patientName = patient?.full_name ?? lead?.full_name ?? ''

  // ── Load system prompt from markdown file ────────────────
  const systemPrompt = await loadClinicPrompt('olu-eye-clinic', {
    clinic_name: 'Olu Eye Clinic',
    clinic_address: '158 Airport Road, Ogogugbo, Benin City 300251, Edo State',
    clinic_phone: '+234 9166015438',
    clinic_services: 'Eye exams, glasses fitting, contact lens fitting, follow-up visits',
    clinic_hours: 'Monday–Saturday, 8am–4pm',
    patient_context: patientContext,
    is_first_message: isFirstMessage ? 'true' : 'false',
    time_of_day: timeOfDay,
    patient_name: patientName,
  })

  // ── Build conversation history for Claude ────────────────
  // Pass previous messages so Claude remembers the full session
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    ...conversationHistory.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.message,
    })),
    // Current incoming message
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
      max_tokens: 400,
      system: systemPrompt,
      messages, // ← full conversation history now
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Claude API error:', data)
    return `Sorry, we're experiencing a brief issue. Please call us on +234 9166015438 or try again in a moment.`
  }

  return data.content?.[0]?.text ?? `Thank you for your message. We'll be in touch shortly.`
}
