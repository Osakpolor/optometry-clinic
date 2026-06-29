// Sends a WhatsApp message to any phone number

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token         = process.env.WHATSAPP_TOKEN

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    console.error('WhatsApp send error:', error)
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`)
  }

  console.log(`✅ WhatsApp message sent to ${to}`)
}

// Sends a booking confirmation message
export async function sendBookingConfirmation({
  to,
  fullName,
  service,
  date,
  time,
}: {
  to: string
  fullName: string
  service: string
  date: string
  time: string
}): Promise<void> {
  const message = `Hello ${fullName}! 👋

Thank you for booking with *Olu Eye Clinic*.

Here's a summary of your request:
📋 *Service:* ${service}
📅 *Preferred date:* ${date}
⏰ *Preferred time:* ${time}

Our team will call you shortly to confirm your appointment. Please keep your phone nearby.

_Olu Eye Clinic · Benin City, Edo State_`

  await sendWhatsAppMessage(to, message)
}

// Sends an appointment reminder
export async function sendAppointmentReminder({
  to,
  fullName,
  date,
  time,
  isToday,
}: {
  to: string
  fullName: string
  date: string
  time: string
  isToday: boolean
}): Promise<void> {
  const message = isToday
    ? `Good morning ${fullName}! 🌅

This is a reminder that you have an appointment at *Olu Eye Clinic today* at *${time}*.

📍 Please arrive 5 minutes early.

See you soon!
_Olu Eye Clinic · Benin City_`
    : `Hello ${fullName}! 👋

Just a reminder that you have an appointment at *Olu Eye Clinic tomorrow* (${date}) at *${time}*.

📍 Please arrive 5 minutes early.

_Olu Eye Clinic · Benin City_`

  await sendWhatsAppMessage(to, message)
}