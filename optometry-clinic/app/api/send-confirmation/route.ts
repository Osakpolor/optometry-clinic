import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const { email, fullName, service, date, time } = await request.json()

  if (!email) {
    return NextResponse.json({ skipped: true })
  }

  try {
    await resend.emails.send({
      from: 'Clearview Optical <onboarding@resend.dev>',
      to: email,
      subject: 'Your appointment is confirmed',
      html: `<p>Hi ${fullName},</p><p>Your ${service.toLowerCase()} appointment is booked for ${date} at ${time}.</p><p>See you then!</p>`,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email send failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}