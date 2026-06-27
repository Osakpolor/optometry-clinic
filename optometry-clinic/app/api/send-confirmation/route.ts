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
      from: 'Olu Eye Clinic <onboarding@resend.dev>',
      to: email,
      subject: 'Appointment request received — Olu Eye Clinic',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="color: #0d7b5f; margin-bottom: 8px;">Olu Eye Clinic</h2>
          <p style="color: #4d4d4d; margin-bottom: 24px; font-size: 14px;">Specialist Optometry Practice, Benin City</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin-bottom: 24px;" />
          <p style="color: #171717;">Hi ${fullName},</p>
          <p style="color: #4d4d4d; font-size: 14px; line-height: 1.6;">
            We've received your appointment request for a <strong>${service.toLowerCase()}</strong>
            on <strong>${date}</strong> at <strong>${time}</strong>.
          </p>
          <p style="color: #4d4d4d; font-size: 14px; line-height: 1.6;">
            Our team will call or WhatsApp you shortly to confirm your slot.
            Please keep your phone nearby.
          </p>
          <div style="background: #f0faf7; border: 1px solid #b3e0d4; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 13px; color: #0d7b5f;">
              <strong>Your request summary</strong><br/>
              Service: ${service}<br/>
              Preferred date: ${date}<br/>
              Preferred time: ${time}
            </p>
          </div>
          <p style="color: #8c8c8c; font-size: 12px; margin-top: 32px;">
            Olu Eye Clinic · Benin City, Edo State, Nigeria
          </p>
        </div>
      `,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email send failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}