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

    // ── Record message arrival time ──────────────────────────
    await supabase
      .from('whatsapp_pending_replies')
      .upsert({
        phone_number: fromNumber,
        last_message_at: receivedAt,
      }, { onConflict: 'phone_number' })

    // ── Save incoming message ────────────────────────────────
    await supabase.from('whatsapp_conversations').insert({
      phone_number: fromNumber,
      role: 'user',
      message: messageText,
    })

    // ── Wait 6 seconds for more messages ────────────────────
    await new Promise(resolve => setTimeout(resolve, 6000))

    // ── Check if newer message arrived during wait ───────────
    const { data: pending } = await supabase
      .from('whatsapp_pending_replies')
      .select('last_message_at')
      .eq('phone_number', fromNumber)
      .single()

    if (pending && pending.last_message_at > receivedAt) {
      console.log(`⏭️ Skipping — newer message exists for ${fromNumber}`)
      return NextResponse.json({ status: 'ok' })
    }

    // ── Load patient or lead ─────────────────────────────────
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
    let allVisits: any[] = []
    if (patient) {
      const { data: visits } = await supabase
        .from('visit_records')
        .select('visit_date, diagnosis, medications, follow_up_date, refraction, notes')
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false })
        .limit(3) // last 3 visits for fuller context

      allVisits = visits ?? []
      recentVisit = allVisits[0] ?? null
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
    const { reply, booking } = await generateClaudeReply({
      fromNumber,
      messageText,
      patient: patient ?? null,
      lead: lead ?? null,
      recentVisit,
      allVisits, 
      conversationHistory: history ?? [],
    })

    // ── Save Claude's reply (clean version, no hidden block) ──
    await supabase.from('whatsapp_conversations').insert({
      phone_number: fromNumber,
      role: 'assistant',
      message: reply,
    })

    // ── Send to WhatsApp ─────────────────────────────────────
    await sendWhatsAppMessage(fromNumber, reply)

    // ── Save confirmed booking to leads ───────────────────────
    if (booking && booking.name && booking.date) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('phone', fromNumber)
        .single()

      if (existingLead) {
        // Update existing lead with new booking info
        await supabase
          .from('leads')
          .update({
            full_name: booking.name,
            service_interest: booking.service ?? 'Eye exam',
            preferred_date: booking.date,
            preferred_time: booking.time,
            status: 'new',
          })
          .eq('id', existingLead.id)
      } else {
        // Create new lead
        await supabase.from('leads').insert({
          full_name: booking.name,
          phone: booking.phone ?? fromNumber,
          service_interest: booking.service ?? 'Eye exam',
          preferred_date: booking.date,
          preferred_time: booking.time,
          status: 'new',
        })
      }

      console.log(`✅ Booking saved for ${booking.name} on ${booking.date} at ${booking.time}`)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ status: 'ok' })
  }
}