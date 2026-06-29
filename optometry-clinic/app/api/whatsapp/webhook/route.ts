import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { generateClaudeReply } from '@/lib/claude-whatsapp'

// ── GET: Meta webhook verification ──────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: Incoming WhatsApp messages ────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const entry    = body?.entry?.[0]
    const changes  = entry?.changes?.[0]
    const value    = changes?.value
    const messages = value?.messages

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: 'ok' })
    }

    const message     = messages[0]
    const fromNumber  = message.from
    const messageText = message.text?.body
    const messageType = message.type

    if (messageType !== 'text' || !messageText) {
      return NextResponse.json({ status: 'ok' })
    }

    console.log(`📱 Message from ${fromNumber}: ${messageText}`)

    const supabase = await createClient()

    // ── Look up patient or lead ──────────────────────────────
    const { data: patient } = await supabase
      .from('patients')
      .select('id, full_name, phone, date_of_birth')
      .or(`phone.eq.${fromNumber},phone.eq.0${fromNumber.slice(3)}`)
      .single()

    const { data: lead } = !patient ? await supabase
      .from('leads')
      .select('id, full_name, phone, service_interest, status, preferred_date, preferred_time')
      .or(`phone.eq.${fromNumber},phone.eq.0${fromNumber.slice(3)}`)
      .single() : { data: null }

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

    // ── Load conversation history BEFORE calling Claude ──────
    const { data: history } = await supabase
      .from('whatsapp_conversations')
      .select('role, message, created_at')
      .eq('phone_number', fromNumber)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(20)

    // ── Save incoming message ────────────────────────────────
    await supabase.from('whatsapp_conversations').insert({
      phone_number: fromNumber,
      role: 'user',
      message: messageText,
    })

    // ── Generate Claude reply with full context ──────────────
    const reply = await generateClaudeReply({
      fromNumber,
      messageText,
      patient: patient ?? null,
      lead: lead ?? null,
      recentVisit,
      conversationHistory: history ?? [],
    })

    // ── Save Claude's reply ──────────────────────────────────
    await supabase.from('whatsapp_conversations').insert({
      phone_number: fromNumber,
      role: 'assistant',
      message: reply,
    })

    // ── Send reply to WhatsApp ───────────────────────────────
    await sendWhatsAppMessage(fromNumber, reply)

    // ── Save booking request to leads if detected ────────────
    const isBookingMessage =
      messageText.toLowerCase().includes('name:') ||
      messageText.toLowerCase().includes('type visit:') ||
      messageText.toLowerCase().includes('preferred date')

    if (isBookingMessage && !patient) {
      const nameMatch  = messageText.match(/name:\s*([^\n]+)/i)
      const phoneMatch = messageText.match(/phone:\s*([^\n]+)/i)
      const visitMatch = messageText.match(/type visit:\s*([^\n]+)/i)
      const dateMatch  = messageText.match(/preferred date[^:]*:\s*([^\n]+)/i)

      const extractedName  = nameMatch?.[1]?.trim()
      const extractedPhone = phoneMatch?.[1]?.trim()
      const extractedVisit = visitMatch?.[1]?.trim()
      const extractedDate  = dateMatch?.[1]?.trim()

      if (extractedName) {
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
    return NextResponse.json({ status: 'ok' })
  }
}