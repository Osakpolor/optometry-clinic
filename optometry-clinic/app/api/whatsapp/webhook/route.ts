import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { generateClaudeReply } from '@/lib/claude-whatsapp'

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
    const receivedAt = new Date().toISOString()

    // ── Record that a message arrived from this number ───────
    await supabase
      .from('whatsapp_pending_replies')
      .upsert({
        phone_number: fromNumber,
        last_message_at: receivedAt,
      }, { onConflict: 'phone_number' })

    // ── Save incoming message immediately ────────────────────
    await supabase.from('whatsapp_conversations').insert({
      phone_number: fromNumber,
      role: 'user',
      message: messageText,
    })

    // ── Wait 6 seconds — buffer for rapid messages ───────────
    await new Promise(resolve => setTimeout(resolve, 6000))

      // ── Acquire reply lock ───────────────────────────────────
      // Prevents duplicate replies from concurrent webhook calls
      const lockKey = `lock_${fromNumber}`
      const { data: existingLock } = await supabase
          .from('whatsapp_pending_replies')
          .select('last_message_at')
          .eq('phone_number', fromNumber)
          .single()

      if (existingLock && existingLock.last_message_at > receivedAt) {
          console.log(`⏭️ Skipping — newer message exists`)
          return NextResponse.json({ status: 'ok' })
      }

      // Mark as being processed
      await supabase
          .from('whatsapp_pending_replies')
          .update({ last_message_at: new Date(Date.now() + 60000).toISOString() })
          .eq('phone_number', fromNumber)

    // ── Check if a newer message arrived during the wait ─────
    const { data: pending } = await supabase
      .from('whatsapp_pending_replies')
      .select('last_message_at')
      .eq('phone_number', fromNumber)
      .single()

    if (pending && pending.last_message_at > receivedAt) {
      // A newer message came in — let that one handle the reply
      console.log(`⏭️ Skipping reply to ${fromNumber} — newer message pending`)
      return NextResponse.json({ status: 'ok' })
    }

    // ── No newer message — safe to reply now ─────────────────
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

    // ── Load conversation history ────────────────────────────
    const { data: history } = await supabase
      .from('whatsapp_conversations')
      .select('role, message, created_at')
      .eq('phone_number', fromNumber)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(20)

    // ── Generate Claude reply ────────────────────────────────
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

    // ── Send to WhatsApp ─────────────────────────────────────
    await sendWhatsAppMessage(fromNumber, reply)

    // ── Save booking to leads if detected ───────────────────
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