'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit']

export default function BookPage() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState(SERVICES[0])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createClient()

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()

  if (!date || !time) {
    setStatus('error')
    setErrorMsg('Please choose both a date and a time.')
    return
  }

  setStatus('submitting')
  setErrorMsg('')

  const patientId = crypto.randomUUID()

  const { error: patientError } = await supabase
    .from('patients')
    .insert({ id: patientId, full_name: fullName, phone, email: email || null })

  if (patientError) {
    setStatus('error')
    setErrorMsg(patientError.message)
    return
  }

  const appointmentDateTime = new Date(`${date}T${time}`).toISOString()

  const { error: appointmentError } = await supabase.from('appointments').insert({
    patient_id: patientId,
    appointment_date: appointmentDateTime,
    service_type: service,
  })

  if (appointmentError) {
    setStatus('error')
    setErrorMsg(appointmentError.message)
    return
  }

  if (email) {
  fetch('/api/send-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName, service, date, time }),
  }).catch(() => {})
}
  setStatus('success')
}

  if (status === 'success') {
    return (
      <main className="mx-auto max-w-md p-10">
        <h1 className="text-2xl font-semibold">Booking confirmed</h1>
        <p className="mt-2 text-gray-600">
          Thanks, {fullName} — we&apos;ve booked your {service.toLowerCase()} for {date} at {time}.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-10">
      <h1 className="text-2xl font-semibold">Book an appointment</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Full name</span>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Phone number</span>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email (optional)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Service</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="rounded border border-gray-300 p-2">
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Date</span>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Time</span>
          <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded border border-gray-300 p-2" />
        </label>
        <button type="submit" disabled={status === 'submitting'} className="mt-2 rounded bg-black p-2 text-white disabled:opacity-50">
          {status === 'submitting' ? 'Booking…' : 'Book appointment'}
        </button>
        {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}
      </form>
    </main>
  )
}