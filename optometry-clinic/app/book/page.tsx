'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit', 'Not sure yet']

function SuccessPage({ fullName }: { fullName: string }) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) { router.push('/'); return }
    const timer = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds, router])

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="mb-4 text-5xl">✓</div>
      <h1 className="text-2xl font-semibold">We'll be in touch!</h1>
      <p className="mt-3 text-gray-500">
        Thanks {fullName} — we've received your request and will contact you shortly to confirm your appointment.
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
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')

    const { error } = await supabase.from('leads').insert({
      full_name: fullName,
      phone,
      email: email || null,
      service_interest: service,
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
      return
    }

    setStatus('success')
  }

  if (status === 'success') {
    return <SuccessPage fullName={fullName} />
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Book an appointment</h1>
      <p className="mt-2 text-gray-500">
        Leave your details and we'll call or WhatsApp you to confirm a time.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base font-medium">Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone number <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
              />
              <p className="text-xs text-gray-400">We'll use this to confirm your appointment via call or WhatsApp</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="for appointment reminders"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Service needed</Label>
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

            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
              By submitting this form, you agree that Olu Eye Clinic may contact you to schedule your appointment. Your details are kept private and never shared.
            </div>

            <Button type="submit" disabled={status === 'submitting'} className="w-full">
              {status === 'submitting' ? 'Submitting…' : 'Request appointment'}
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