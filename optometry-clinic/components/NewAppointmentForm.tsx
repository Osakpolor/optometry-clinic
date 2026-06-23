'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit']

export default function NewAppointmentForm({ patientId }: { patientId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [service, setService] = useState(SERVICES[0])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) { setErrorMsg('Please select both a date and time.'); return }
    setSaving(true)
    setErrorMsg('')

    const { error } = await supabase.from('appointments').insert({
      patient_id: patientId,
      appointment_date: new Date(`${date}T${time}`).toISOString(),
      service_type: service,
      status: 'booked',
    })

    setSaving(false)
    if (error) { setErrorMsg(error.message); return }

    await new Promise(resolve => setTimeout(resolve, 500))
    router.push(`/dashboard/patients/${patientId}`)
    router.refresh()
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Appointment details</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Service</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Time</Label>
              <Input type="time" required value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          <Button type="submit" disabled={saving} className="w-full mt-2">
            {saving ? 'Booking…' : 'Book appointment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}