// app/api/whatsapp/send/route.ts
// Staff-triggered outbound WhatsApp message — used by the Rebooking page
// when a receptionist rejects or responds to a rebook request.
// Gated: only authenticated staff with can_reply access may call this.

import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppMessage, logWhatsAppMessage } from '@/lib/whatsapp'
import { getCurrentStaff, resolveAccess } from '@/lib/conversationAccess'

export async function POST(req: NextRequest) {
  try {
    // Auth check — must be signed-in staff with reply permission
    const staff = await getCurrentStaff()
    if (!staff) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }
    const access = await resolveAccess(staff.role)
    if (!access.can_reply) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { to, message } = await req.json()
    if (!to || !message?.trim()) {
      return NextResponse.json({ error: 'Missing to or message' }, { status: 400 })
    }

    const result = await sendWhatsAppMessage(to, message.trim())
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 500 })
    }

    // Log so it appears in the staff conversations inbox
    await logWhatsAppMessage(to, 'assistant', message.trim())

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Staff WhatsApp send error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}