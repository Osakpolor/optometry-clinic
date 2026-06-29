// Claude reads the patient's record and generates a personalised reply

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
}

export async function generateClaudeReply(ctx: ReplyContext): Promise<string> {
  const { messageText, patient, lead, recentVisit } = ctx

  // Build context string for Claude
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

MOST RECENT VISIT (${new Date(recentVisit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}):
- Diagnosis: ${recentVisit.diagnosis ?? 'not recorded'}
- Medications prescribed: ${meds.length > 0 ? meds.map((m: any) => `${m.name} ${m.freq ?? ''}`).join(', ') : 'none'}
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

  const systemPrompt = `You are a friendly, professional assistant for Olu Eye Clinic, a specialist optometry practice in Benin City, Nigeria. You reply to WhatsApp messages from patients and leads on behalf of the clinic.

CLINIC INFORMATION:
- Name: Olu Eye Clinic
- Location: Benin City, Edo State, Nigeria
- Services: Eye exams, glasses fitting, contact lens fitting, follow-up visits
- Language: Respond in the same language the patient uses. Most patients write in English or Nigerian Pidgin.

YOUR ROLE:
- Answer questions about appointments, prescriptions, and clinic services
- Remind patients of upcoming follow-ups if relevant
- Help new enquiries understand how to book
- Be warm, concise, and professional
- Never diagnose or give specific medical advice — always say "please come in for an examination"
- Keep replies SHORT — WhatsApp messages should be under 150 words
- Use WhatsApp formatting: *bold* for important info, line breaks for readability

${patientContext}

IMPORTANT: You are replying on behalf of the clinic, not as a patient. Never reveal that you are an AI unless directly asked.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Patient message: "${messageText}"\n\nPlease reply on behalf of Olu Eye Clinic.`
        }
      ],
      system: systemPrompt,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Claude API error:', data)
    // Fallback message if Claude fails
    return `Hello! Thank you for contacting Olu Eye Clinic. We'll get back to you shortly. For urgent matters, please call us directly.`
  }

  return data.content?.[0]?.text ?? `Thank you for your message. A member of our team will be in touch shortly.`
}