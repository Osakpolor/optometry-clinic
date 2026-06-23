'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit']

function SuccessPage({ fullName, service, date, time }: {
  fullName: string; service: string; date: string; time: string
}) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) { router.push('/'); return }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, router])

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="mb-4 text-4xl">✓</div>
      <h1 className="text-2xl font-semibold">Booking confirmed</h1>
      <p className="mt-3 text-gray-500">
        Thanks, {fullName} — your {service.toLowerCase()} is booked for {date} at {time}.
        We&apos;ll send a confirmation to your email.
      </p>
      <p className="mt-6 text-sm text-gray-400">
        Redirecting to home in {seconds} second{seconds !== 1 ? 's' : ''}…
      </p>
    </main>
  )
}

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
    return <SuccessPage fullName={fullName} service={service} date={date} time={time} />
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Book an appointment</h1>
      <p className="mt-2 text-gray-500">Fill in your details and we&apos;ll confirm your slot.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base font-medium">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Amaka Obi" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 08012345678" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address (optional)</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="for confirmation email" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Service</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" required type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="time">Time</Label>
                <Input id="time" required type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>

            <Button type="submit" disabled={status === 'submitting'} className="w-full mt-2">
              {status === 'submitting' ? 'Booking…' : 'Book appointment'}
            </Button>

            {status === 'error' && (
              <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  )
}