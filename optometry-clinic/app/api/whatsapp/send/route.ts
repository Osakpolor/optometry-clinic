import { NextRequest, NextResponse } from 'next/server'
import { sendBookingConfirmation } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { phone, fullName, service, date, time } = await req.json()

    if (!phone || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Normalise Nigerian number: 08012345678 → 2348012345678
    let to = phone.replace(/\s+/g, '')
    if (to.startsWith('0')) {
      to = '234' + to.slice(1)
    }
    if (!to.startsWith('234')) {
      to = '234' + to
    }

    await sendBookingConfirmation({ to, fullName, service, date, time })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Send WhatsApp error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}