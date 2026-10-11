'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { CalendarPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  bookAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from '@/app/actions/appointmentActions'

type Appointment = {
  id: string
  appointment_date: string
  service_type: string | null
  status: string
}

type Props = {
  patientId: string
  patientName: string
  appointments: Appointment[]
  // Computed server-side and passed down — the server actions guard again,
  // this only decides whether to show the controls.
  canManage: boolean
}

// Doubles as the "reason" for the visit — writes to appointments.service_type.
const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit']

const STATUS_PILL: Record<string, string> = {
  booked:    'bg-blue-50 text-blue-700 border-blue-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-gray-50 text-gray-600 border-gray-200',
  no_show:   'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-red-50 text-red-400 border-red-100',
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Local "today" as YYYY-MM-DD, used as the min for date inputs so staff
// can't book or reschedule into the past.
function todayIso() {
  const d = new Date()
  const offsetMs = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10)
}

export function AppointmentSlideOver({
  patientId,
  patientName,
  appointments,
  canManage,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // New-appointment form state
  const [date, setDate] = useState('')
  const [service, setService] = useState(SERVICES[0])
  const [note, setNote] = useState('')

  // Per-row UI state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)

  const min = todayIso()

  function resetForm() {
    setDate('')
    setService(SERVICES[0])
    setNote('')
  }

  function handleBook() {
    if (!date) { toast.error('Please choose a date.'); return }
    startTransition(async () => {
      const res = await bookAppointment(patientId, { date, serviceType: service, note })
      if (res.error) { toast.error(res.error); return }
      toast.success(`Appointment booked for ${formatDay(`${date}T12:00:00`)}.`)
      resetForm()
      router.refresh()
    })
  }

  function startReschedule(a: Appointment) {
    setConfirmingCancelId(null)
    setEditingId(a.id)
    setEditDate(a.appointment_date.slice(0, 10))
  }

  function handleReschedule(id: string) {
    if (!editDate) { toast.error('Please choose a new date.'); return }
    startTransition(async () => {
      const res = await rescheduleAppointment(id, editDate)
      if (res.error) { toast.error(res.error); return }
      toast.success(`Appointment moved to ${formatDay(`${editDate}T12:00:00`)}.`)
      setEditingId(null)
      router.refresh()
    })
  }

  function handleCancel(id: string) {
    startTransition(async () => {
      const res = await cancelAppointment(id)
      if (res.error) { toast.error(res.error); return }
      toast.success('Appointment cancelled.')
      setConfirmingCancelId(null)
      router.refresh()
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
        Book / manage
      </Button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          />
          <DialogPrimitive.Content
            className={cn(
              'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col',
              'bg-background shadow-xl ring-1 ring-foreground/10 outline-none',
              'data-open:animate-in data-closed:animate-out',
              'data-open:slide-in-from-right data-closed:slide-out-to-right',
              'data-open:duration-300 data-closed:duration-200'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <DialogPrimitive.Title className="font-heading text-base font-semibold">
                  Appointments
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-muted-foreground">
                  {patientName}
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Book new — day-level only (walk-in clinic, no time slots) */}
              {canManage && (
                <section className="rounded-lg border border-brand/20 bg-brand/5 p-4">
                  <h3 className="font-heading text-sm font-semibold text-brand mb-3">
                    Book a new appointment
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        min={min}
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Reason</Label>
                      <select
                        value={service}
                        onChange={e => setService(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">
                        Note
                        <span className="ml-1.5 text-muted-foreground/60 font-normal">optional</span>
                      </Label>
                      <Input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Anything the front desk should know"
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={handleBook}
                      disabled={isPending || !date}
                      className="w-full"
                    >
                      {isPending ? 'Booking…' : 'Book appointment'}
                    </Button>
                  </div>
                </section>
              )}

              {/* Existing appointments */}
              <section>
                <h3 className="font-heading text-sm font-semibold mb-3">
                  Existing appointments
                </h3>
                {appointments.length ? (
                  <ul className="flex flex-col gap-2">
                    {appointments.map(a => {
                      const isClosed = a.status === 'cancelled' || a.status === 'completed'
                      return (
                        <li
                          key={a.id}
                          className="rounded-lg border border-border px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{formatDay(a.appointment_date)}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {a.service_type ?? 'Appointment'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 rounded-full border px-2 py-0.5 text-xs',
                                STATUS_PILL[a.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                              )}
                            >
                              {a.status}
                            </span>
                          </div>

                          {/* Actions — hidden for cancelled/completed and non-managers */}
                          {canManage && !isClosed && (
                            <div className="mt-2.5">
                              {editingId === a.id ? (
                                <div className="flex items-end gap-2">
                                  <div className="flex flex-col gap-1">
                                    <Label className="text-xs">New date</Label>
                                    <Input
                                      type="date"
                                      min={min}
                                      value={editDate}
                                      onChange={e => setEditDate(e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleReschedule(a.id)}
                                    disabled={isPending}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                    disabled={isPending}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : confirmingCancelId === a.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Cancel this appointment?
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCancel(a.id)}
                                    disabled={isPending}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    {isPending ? 'Cancelling…' : 'Yes, cancel'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmingCancelId(null)}
                                    disabled={isPending}
                                  >
                                    Keep
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startReschedule(a)}
                                  >
                                    Reschedule
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setEditingId(null); setConfirmingCancelId(a.id) }}
                                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No appointments yet.
                  </p>
                )}
              </section>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
