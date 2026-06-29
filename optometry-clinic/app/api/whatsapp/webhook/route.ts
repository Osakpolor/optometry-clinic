import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { generateClaudeReply } from '@/lib/claude-whatsapp'

// ── GET: Meta webhook verification ──────────────────────────
// When you save the webhook URL in Meta portal, Meta sends a
// GET request to verify it's really your server.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    // Return the challenge number — Meta confirms the webhook is valid
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: Incoming WhatsApp messages ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Meta sends a nested structure — dig into it
    const entry    = body?.entry?.[0]
    const changes  = entry?.changes?.[0]
    const value    = changes?.value
    const messages = value?.messages

    // Ignore if no messages (could be a status update)
    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const message     = messages[0]
    const fromNumber  = message.from        // e.g. "2348012345678"
    const messageText = message.text?.body  // what they typed
    const messageType = message.type        // "text", "image", etc.

    // Only handle text messages for now
    if (messageType !== 'text' || !messageText) {
      return NextResponse.json({ status: 'ok' })
    }

    console.log(`📱 Message from ${fromNumber}: ${messageText}`)

    // Look up who this is in Supabase
    const supabase = await createClient()

    // Check patients table first
    const { data: patient } = await supabase
      .from('patients')
      .select('id, full_name, phone, date_of_birth')
      .or(`phone.eq.${fromNumber},phone.eq.0${fromNumber.slice(3)}`)
      .single()

    // If not a patient, check leads table
    const { data: lead } = !patient ? await supabase
      .from('leads')
      .select('id, full_name, phone, service_interest, status, preferred_date, preferred_time')
      .or(`phone.eq.${fromNumber},phone.eq.0${fromNumber.slice(3)}`)
      .single() : { data: null }

    // Get their most recent visit if they're a patient
    let recentVisit = null
    if (patient) {
      const { data: visit } = await supabase
        .from('visit_records')
        .select('visit_date, diagnosis, medications, follow_up_date, refraction')
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false })
        .limit(1)
        .single()
      recentVisit = visit
    }

    // Generate AI reply using Claude
const reply = await generateClaudeReply({
  fromNumber,
  messageText,
  patient: patient ?? null,
  lead: lead ?? null,
  recentVisit,
})

// Send the reply back via WhatsApp
await sendWhatsAppMessage(fromNumber, reply)

// ── Save to Supabase if this looks like a booking request ──
// Check if message contains booking info (name, date, visit type)
const isBookingMessage = 
  messageText.toLowerCase().includes('name:') ||
  messageText.toLowerCase().includes('type visit:') ||
  messageText.toLowerCase().includes('preferred date')

if (isBookingMessage && !patient) {
  // Extract details from message using simple parsing
  const nameMatch = messageText.match(/name:\s*([^\n]+)/i)
  const phoneMatch = messageText.match(/phone:\s*([^\n]+)/i)
  const visitMatch = messageText.match(/type visit:\s*([^\n]+)/i)
  const dateMatch = messageText.match(/preferred date[^:]*:\s*([^\n]+)/i)

  const extractedName = nameMatch?.[1]?.trim()
  const extractedPhone = phoneMatch?.[1]?.trim()
  const extractedVisit = visitMatch?.[1]?.trim()
  const extractedDate = dateMatch?.[1]?.trim()

  if (extractedName) {
    // Check if lead already exists for this number
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', fromNumber)
      .single()

    if (!existingLead) {
      await supabase.from('leads').insert({
        full_name: extractedName,
        phone: extractedPhone ?? fromNumber,
        service_interest: extractedVisit ?? 'Eye exam',
        status: 'new',
        notes: `WhatsApp booking request. Preferred: ${extractedDate ?? 'not specified'}`,
      })
    }
  }
}

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Webhook error:', error)
    // Always return 200 to Meta — otherwise it retries endlessly
    return NextResponse.json({ status: 'ok' })
  }
}