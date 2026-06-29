'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { ChevronLeft } from 'lucide-react'

const SERVICES = [
  'Eye exam',
  'Glasses fitting',
  'Contact lens fitting',
  'Follow-up visit',
  'Not sure yet',
]

const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM',
]

// ── Success screen ─────────────────────────────────────────
function SuccessScreen({ fullName, date, time }: { fullName: string; date: string; time: string }) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(6)

  useEffect(() => {
    if (seconds <= 0) { router.push('/'); return }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, router])

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-5">
        <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Request received!</h1>
      <p className="mt-3 text-sm text-gray-500 leading-relaxed">
        Thanks {fullName} — we've noted your preferred slot for <strong>{date}</strong> at <strong>{time}</strong>.
        We'll call or WhatsApp you shortly to confirm.
      </p>
      <div className="mt-6 rounded-lg bg-brand/5 border border-brand/20 px-4 py-3 text-xs text-brand">
        Keep your phone nearby — we'll be in touch soon.
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Redirecting to home in {seconds}s…
      </p>
    </main>
  )
}

// ── Step indicator ─────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {[1, 2].map(n => (
        <div key={n} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all
            ${step === n
              ? 'bg-brand text-white'
              : step > n
              ? 'bg-brand/20 text-brand'
              : 'bg-gray-100 text-gray-400'
            }`}
          >
            {step > n ? '✓' : n}
          </div>
          <span className={`text-sm ${step === n ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {n === 1 ? 'Your details' : 'Pick a time'}
          </span>
          {n < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function BookPage() {
  const supabase = createClient()

  // Step 1 fields
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState(SERVICES[0])

  // Step 2 fields
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string>('')

  // UI state
  const [step, setStep] = useState<1 | 2>(1)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Disable past dates and Sundays on the calendar
  function isDateDisabled(date: Date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const isSunday = date.getDay() === 0
    const isPast = date < today
    return isPast || isSunday
  }

  function formatDate(date: Date) {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDate || !selectedTime) return

    setStatus('submitting')
    setErrorMsg('')

    const dateStr = formatDate(selectedDate)

    // Save lead to Supabase
    const { error } = await supabase.from('leads').insert({
      full_name: fullName,
      phone,
      email: email || null,
      service_interest: service,
      preferred_date: selectedDate.toISOString().slice(0, 10), // "2026-06-27"
      preferred_time: selectedTime,                             // "10:00 AM"
    })

    if (error) {
      setStatus('error')
      setErrorMsg('Something went wrong. Please try again or call us directly.')
      return
    }

    // Send WhatsApp confirmation
    await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        fullName,
        service,
        date: dateStr,
        time: selectedTime,
      }),
    })

    // Send confirmation email if they provided one
    if (email) {
      await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          service,
          date: dateStr,
          time: selectedTime,
        }),
      })
    }

    setStatus('success')
  }

  if (status === 'success' && selectedDate) {
    return (
      <SuccessScreen
        fullName={fullName}
        date={formatDate(selectedDate)}
        time={selectedTime}
      />
    )
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Book an appointment
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {step === 1
            ? 'Tell us about yourself and what you need.'
            : 'Choose your preferred date and time.'}
        </p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <Card className="border border-border shadow-none">
          <CardContent className="pt-6">
            <form onSubmit={handleStep1} className="flex flex-col gap-5">

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName">Full name <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">
                  Phone number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phone"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                />
                <p className="text-xs text-gray-400">
                  We'll confirm your appointment by call or WhatsApp
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">
                  Email address{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="For appointment reminders"
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

              <div className="rounded-lg bg-gray-50 border border-border px-4 py-3 text-xs text-gray-500">
                By submitting this form, you agree that Olu Eye Clinic may contact
                you to schedule your appointment. Your details are kept private.
              </div>

              <Button type="submit" className="w-full">
                Next — choose a time →
              </Button>

            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Calendar + time slots ── */}
      {step === 2 && (
        <form onSubmit={handleStep2} className="flex flex-col gap-6">

          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to your details
          </button>

          {/* Summary of step 1 */}
          <div className="rounded-lg border border-border bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{fullName}</p>
            <p className="text-xs text-gray-500 mt-0.5">{phone} · {service}</p>
          </div>

          {/* Calendar */}
          <Card className="border border-border shadow-none">
            <CardContent className="pt-5 flex flex-col items-center">
              <p className="text-sm font-medium text-gray-700 mb-3 self-start">
                Select a date
              </p>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date)
                  setSelectedTime('') // reset time when date changes
                }}
                disabled={isDateDisabled}
                className="rounded-md"
              />
            </CardContent>
          </Card>

          {/* Time slots — only show after a date is picked */}
          {selectedDate && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Available times on{' '}
                <span className="text-brand">
                  {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {TIME_SLOTS.map(slot => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-all
                      ${selectedTime === slot
                        ? 'bg-brand text-white border-brand'
                        : 'bg-white text-gray-700 border-border hover:border-brand/40 hover:bg-brand/5'
                      }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          {selectedDate && selectedTime && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg bg-brand/5 border border-brand/20 px-4 py-3 text-sm text-brand">
                <span className="font-medium">Selected: </span>
                {formatDate(selectedDate)} at {selectedTime}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? 'Submitting…' : 'Confirm appointment request'}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-red-500 text-center">{errorMsg}</p>
          )}

        </form>
      )}

    </main>
  )
}