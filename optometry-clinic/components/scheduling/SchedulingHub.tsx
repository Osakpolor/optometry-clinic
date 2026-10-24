'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, List } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { clinicDay } from '@/lib/scheduling-config'
import CalendarView from '@/components/scheduling/CalendarView'
import { approveRebook, declineRebook } from '@/app/actions/rebookActions'
import {
  rescheduleAppointment,
  cancelAppointment,
} from '@/app/actions/appointmentActions'

type PendingRequest = {
  id: string
  patientId: string | null
  patientName: string
  phone: string
  requestedDate: string | null
  requestedTime: string | null
  service: string | null
  notes: string | null
  createdAt: string
  fileNumber: string | null
}

type Appointment = {
  id: string
  patientId: string | null
  patientName: string
  date: string
  serviceType: string | null
  status: string
}

type Props = {
  pendingRequests: PendingRequest[]
  appointments: Appointment[]
  calendarAppointments: Appointment[]
  counts: { today: number; upcoming: number; pending: number }
  todayStr: string
  canManage: boolean
}

type Tab = 'pending' | 'today' | 'upcoming'
type View = 'list' | 'calendar'

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
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Uniformly surface a server action's { error | warning | success }.
function reportResult(res: { error?: string; warning?: string }, okMsg: string): boolean {
  if (res.error) { toast.error(res.error); return false }
  if (res.warning) { toast.warning(res.warning); return true }
  toast.success(okMsg); return true
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn(
      'shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize',
      STATUS_PILL[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
    )}>
      {status.replace('_', ' ')}
    </span>
  )
}

// One appointment row. Each row is its OWN component instance with its OWN
// useTransition + open/confirm state, so acting on one row never flips the
// pending/disabled state of any other row (the previous shared-state bug).
// Quick-actions are Reschedule + Cancel only — no Confirm here (the `confirmed`
// status is set from the manage/detail view, and later from a patient WhatsApp
// reply). Cancel is QUIET at rest (ghost); the red/danger emphasis lives on the
// confirmation step, which also guards against accidental cancels.
function AppointmentRow({
  a, canManage, todayStr,
}: { a: Appointment; canManage: boolean; todayStr: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  function doReschedule() {
    if (!rescheduleDate) { toast.error('Please choose a new date.'); return }
    startTransition(async () => {
      const res = await rescheduleAppointment(a.id, rescheduleDate)
      if (reportResult(res, `Appointment moved to ${formatDay(`${rescheduleDate}T12:00:00`)}.`)) {
        setRescheduling(false)
        router.refresh()
      }
    })
  }

  function doCancel() {
    startTransition(async () => {
      const res = await cancelAppointment(a.id)
      if (reportResult(res, 'Appointment cancelled.')) {
        setConfirmingCancel(false)
        router.refresh()
      }
    })
  }

  return (
    <li className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={a.patientId ? `/dashboard/patients/${a.patientId}` : '#'}
            className="text-sm font-medium text-[#171717] hover:text-brand hover:underline"
          >
            {a.patientName}
          </Link>
          <p className="text-xs text-gray-500">
            {formatDay(a.date)} · {a.serviceType ?? 'Appointment'}
          </p>
        </div>
        <StatusPill status={a.status} />
      </div>

      {canManage && (
        <div className="mt-3">
          {rescheduling ? (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">New date</Label>
                <Input
                  type="date"
                  min={todayStr}
                  value={rescheduleDate}
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button size="sm" onClick={doReschedule} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          ) : confirmingCancel ? (
            // Red emphasis lives HERE, at the point of confirmation — not on the
            // resting trigger above.
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Cancel this appointment?</span>
              <Button size="sm" variant="destructive" onClick={doCancel} disabled={isPending}>
                {isPending ? 'Cancelling…' : 'Yes, cancel'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingCancel(false)} disabled={isPending}>
                Keep
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setConfirmingCancel(false); setRescheduleDate(a.date.slice(0, 10)); setRescheduling(true) }}
              >
                Reschedule
              </Button>
              {/* Quiet at rest — low-weight ghost, not loud red. */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => { setRescheduling(false); setConfirmingCancel(true) }}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export default function SchedulingHub({
  pendingRequests,
  appointments,
  calendarAppointments,
  counts,
  todayStr,
  canManage,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [view, setView] = useState<View>('list')
  const [tab, setTab] = useState<Tab>(counts.pending > 0 ? 'pending' : 'today')

  // Lane 1 — reschedule-request panels
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveDate, setApproveDate] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineMsg, setDeclineMsg] = useState('')
  const [declineNote, setDeclineNote] = useState('')

  const todayAppts = appointments.filter(a => clinicDay(a.date) === todayStr)
  const upcomingAppts = appointments.filter(a => clinicDay(a.date) > todayStr)

  // ── Lane 1 handlers ──────────────────────────────────────────────────────
  function openApprove(req: PendingRequest) {
    setDecliningId(null)
    setApprovingId(req.id)
    setApproveDate(req.requestedDate ? req.requestedDate.slice(0, 10) : '')
    setApproveNote('')
  }

  function handleApprove(id: string) {
    if (!approveDate) { toast.error('Please choose a date.'); return }
    startTransition(async () => {
      const res = await approveRebook(id, approveDate, approveNote)
      if (reportResult(res, 'Reschedule approved and patient notified.')) {
        setApprovingId(null)
        router.refresh()
      }
    })
  }

  function openDecline(req: PendingRequest) {
    setApprovingId(null)
    setDecliningId(req.id)
    setDeclineMsg(
      `Hi ${req.patientName}, unfortunately we can't confirm your requested reschedule. ` +
      `Please call us on 09166015438 and we'll find a day that works. - Olu Eye Clinic`
    )
    setDeclineNote('')
  }

  function handleDecline(id: string) {
    if (!declineMsg.trim()) { toast.error('A message to the patient is required.'); return }
    startTransition(async () => {
      const res = await declineRebook(id, declineMsg, declineNote)
      if (reportResult(res, 'Request declined and patient notified.')) {
        setDecliningId(null)
        router.refresh()
      }
    })
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function Tile({ label, value, tabKey }: { label: string; value: number; tabKey: Tab }) {
    const active = tab === tabKey
    return (
      <button
        onClick={() => { setView('list'); setTab(tabKey) }}
        className={cn(
          'flex flex-col items-start rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition-colors',
          active ? 'border-brand ring-1 ring-brand/30' : 'border-gray-200 hover:border-brand/40'
        )}
      >
        <span className="text-2xl font-semibold text-[#171717]">{value}</span>
        <span className="text-xs text-gray-500 mt-0.5">{label}</span>
      </button>
    )
  }

  function ApptList({ items, emptyLabel }: { items: Appointment[]; emptyLabel: string }) {
    if (!items.length) {
      return (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          {emptyLabel}
        </div>
      )
    }
    return (
      <ul className="flex flex-col gap-2">
        {items.map(a => (
          <AppointmentRow key={a.id} a={a} canManage={canManage} todayStr={todayStr} />
        ))}
      </ul>
    )
  }

  return (
    <main>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-[#171717]">Scheduling</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reschedule requests and the appointment book, in one place.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Tile label="Today" value={counts.today} tabKey="today" />
        <Tile label="Upcoming" value={counts.upcoming} tabKey="upcoming" />
        <Tile label="Pending" value={counts.pending} tabKey="pending" />
      </div>

      {/* View toggle + filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* List / Calendar segmented switch */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setView('list')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm transition-colors',
              view === 'list' ? 'bg-brand text-white' : 'text-gray-600 hover:text-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm transition-colors',
              view === 'calendar' ? 'bg-brand text-white' : 'text-gray-600 hover:text-foreground'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>

        {/* Filter tabs — only relevant in list view */}
        {view === 'list' && (
          <div className="inline-flex gap-1">
            {([
              ['pending', 'Pending', counts.pending],
              ['today', 'Today', counts.today],
              ['upcoming', 'Upcoming', counts.upcoming],
            ] as [Tab, string, number][]).map(([key, labelText, count]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  tab === key ? 'bg-gray-100 font-medium text-foreground' : 'text-gray-500 hover:text-foreground'
                )}
              >
                {labelText}
                <span className="ml-1.5 text-xs text-gray-400">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Calendar view (Phase 3) — day-level occupancy heat */}
      {view === 'calendar' ? (
        <CalendarView
          appointments={calendarAppointments}
          todayStr={todayStr}
          canManage={canManage}
        />
      ) : tab === 'pending' ? (
        /* ── Lane 1: reschedule requests ── */
        pendingRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            No pending reschedule requests — you're all caught up.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={req.patientId ? `/dashboard/patients/${req.patientId}` : '#'}
                          className="font-medium text-[#171717] hover:text-brand hover:underline"
                        >
                          {req.patientName}
                        </Link>
                        {req.fileNumber && <span className="text-xs text-gray-400">#{req.fileNumber}</span>}
                        <StatusPill status="pending" />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{req.phone}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{timeAgo(req.createdAt)}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Requested day</span>
                      <p className="font-medium text-[#171717]">
                        {req.requestedDate ? formatDay(req.requestedDate) : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Time preference</span>
                      <p className="font-medium text-[#171717]">{req.requestedTime ?? 'Not specified'}</p>
                    </div>
                    {(req.service || req.notes) && (
                      <div className="col-span-2">
                        <span className="text-gray-400">From the patient</span>
                        <p className="font-medium text-[#171717]">{req.service ?? req.notes}</p>
                      </div>
                    )}
                  </div>

                  {canManage && approvingId !== req.id && decliningId !== req.id && (
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => openApprove(req)}>Approve &amp; reschedule</Button>
                      <Button size="sm" variant="destructive" onClick={() => openDecline(req)}>Decline</Button>
                    </div>
                  )}
                </div>

                {/* Approve panel */}
                {approvingId === req.id && (
                  <div className="border-t border-brand/15 bg-brand/5 px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand">Approve &amp; reschedule</p>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Appointment day</Label>
                      <Input type="date" min={todayStr} value={approveDate} onChange={e => setApproveDate(e.target.value)} className="text-sm" />
                      <p className="text-xs text-gray-400">This cancels the patient's current upcoming appointment and books the new day.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Internal note <span className="text-gray-400 font-normal">optional</span></Label>
                      <Input value={approveNote} onChange={e => setApproveNote(e.target.value)} placeholder="e.g. Confirmed by phone" className="text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(req.id)} disabled={isPending || !approveDate}>
                        {isPending ? 'Saving…' : 'Confirm & book'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setApprovingId(null)} disabled={isPending}>Cancel</Button>
                    </div>
                  </div>
                )}

                {/* Decline panel */}
                {decliningId === req.id && (
                  <div className="border-t border-red-100 bg-red-50 px-5 py-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-500">Decline &amp; reply</p>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Message to patient <span className="text-red-400">*</span></Label>
                      <textarea
                        rows={4}
                        value={declineMsg}
                        onChange={e => setDeclineMsg(e.target.value)}
                        className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                      <p className="text-xs text-gray-400">Sent to the patient on WhatsApp.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Internal note <span className="text-gray-400 font-normal">optional, not sent</span></Label>
                      <Input value={declineNote} onChange={e => setDeclineNote(e.target.value)} placeholder="e.g. Fully booked that week" className="text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => handleDecline(req.id)} disabled={isPending || !declineMsg.trim()}>
                        {isPending ? 'Sending…' : 'Send & decline'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDecliningId(null)} disabled={isPending}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : tab === 'today' ? (
        <ApptList items={todayAppts} emptyLabel="No appointments today." />
      ) : (
        <ApptList items={upcomingAppts} emptyLabel="No upcoming appointments." />
      )}
    </main>
  )
}
