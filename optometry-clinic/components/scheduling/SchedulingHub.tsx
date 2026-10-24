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
import CalendarView from '@/components/scheduling/CalendarView'
import { approveRebook, declineRebook } from '@/app/actions/rebookActions'
import {
  rescheduleAppointment,
  setAppointmentStatus,
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

type Filter = { from: string; to: string; status: string }

type Props = {
  pendingRequests: PendingRequest[]
  listAppointments: Appointment[]
  calendarAppointments: Appointment[]
  counts: { today: number; upcoming: number; pending: number }
  todayStr: string
  canManage: boolean
  filter: Filter
  initialTab: Tab
}

type Tab = 'pending' | 'appointments'
type View = 'list' | 'calendar'

const STATUS_OPTIONS = ['all', 'booked', 'confirmed', 'completed', 'no_show', 'cancelled'] as const

// Colour = state only (see claude/engineering-standards.md § Colour discipline).
// booked is the common/default state → neutral; green = done; amber = attention;
// red = a bad outcome; cancelled is de-emphasised neutral, not loud red.
const STATUS_PILL: Record<string, string> = {
  booked:    'bg-gray-100 text-gray-700 border-gray-200',   // common/default — neutral
  confirmed: 'bg-green-50 text-green-700 border-green-200',  // success
  completed: 'bg-green-50 text-green-700 border-green-200',  // done
  pending:   'bg-amber-50 text-amber-700 border-amber-200',  // needs attention
  no_show:   'bg-red-50 text-red-700 border-red-200',        // bad outcome — flag it
  cancelled: 'bg-gray-50 text-gray-400 border-gray-200',     // de-emphasised neutral
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

type SetStatus = 'confirmed' | 'completed' | 'no_show' | 'cancelled'

// One appointment row. Each row is its OWN component instance with its OWN
// useTransition + mode state, so acting on one row never flips another row's
// pending/disabled state. Controls: Reschedule + a compact status control
// (confirmed / completed / no-show / cancelled — replaces the old per-row
// Confirm button and the old Appointments page dropdown). Per the colour +
// quiet-destructive conventions the triggers are quiet (ghost); the red
// emphasis appears ONLY on the confirmation step for the destructive
// transitions (cancelled, no-show).
function AppointmentRow({
  a, canManage, todayStr,
}: { a: Appointment; canManage: boolean; todayStr: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'status' | 'confirm'>('idle')
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [target, setTarget] = useState<'cancelled' | 'no_show' | null>(null)

  // Terminal states aren't managed from the list.
  const terminal = a.status === 'cancelled' || a.status === 'completed'

  const statusActions = ([
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'no_show',   label: 'No-show' },
    { value: 'cancelled', label: 'Cancel' },
  ] as { value: SetStatus; label: string }[]).filter(o => o.value !== a.status)

  function doReschedule() {
    if (!rescheduleDate) { toast.error('Please choose a new date.'); return }
    startTransition(async () => {
      const res = await rescheduleAppointment(a.id, rescheduleDate)
      if (reportResult(res, `Appointment moved to ${formatDay(`${rescheduleDate}T12:00:00`)}.`)) {
        setMode('idle'); router.refresh()
      }
    })
  }

  function applyStatus(status: SetStatus) {
    startTransition(async () => {
      const res = await setAppointmentStatus(a.id, status)
      const msg =
        status === 'confirmed' ? 'Appointment confirmed.'
        : status === 'completed' ? 'Marked as completed.'
        : status === 'no_show' ? 'Marked as no-show.'
        : 'Appointment cancelled.'
      if (reportResult(res, msg)) { setMode('idle'); setTarget(null); router.refresh() }
    })
  }

  // Destructive transitions go through the confirmation step; the rest apply now.
  function chooseStatus(status: SetStatus) {
    if (status === 'cancelled' || status === 'no_show') { setTarget(status); setMode('confirm') }
    else applyStatus(status)
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

      {canManage && !terminal && (
        <div className="mt-3">
          {mode === 'reschedule' ? (
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
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={isPending}>Cancel</Button>
            </div>
          ) : mode === 'confirm' ? (
            // Red lives HERE, at the point of confirmation — not on the resting trigger.
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">
                {target === 'cancelled' ? 'Cancel this appointment?' : 'Mark this appointment as no-show?'}
              </span>
              <Button size="sm" variant="destructive" onClick={() => target && applyStatus(target)} disabled={isPending}>
                {isPending ? 'Saving…' : target === 'cancelled' ? 'Yes, cancel' : 'Yes, no-show'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setMode('status'); setTarget(null) }} disabled={isPending}>Back</Button>
            </div>
          ) : mode === 'status' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Set status:</span>
              {statusActions.map(o => (
                <Button
                  key={o.value}
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => chooseStatus(o.value)}
                  disabled={isPending}
                >
                  {o.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={isPending}>Close</Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => { setRescheduleDate(a.date.slice(0, 10)); setMode('reschedule') }}
              >
                Reschedule
              </Button>
              {/* Quiet at rest — opens the compact status control. */}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setMode('status')}
              >
                Set status
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
  listAppointments,
  calendarAppointments,
  counts,
  todayStr,
  canManage,
  filter,
  initialTab,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [view, setView] = useState<View>('list')
  const [tab, setTab] = useState<Tab>(initialTab)

  // Lane 1 — reschedule-request panels
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approveDate, setApproveDate] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineMsg, setDeclineMsg] = useState('')
  const [declineNote, setDeclineNote] = useState('')

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
  function Tile({ label, value, targetTab }: { label: string; value: number; targetTab: Tab }) {
    const active = tab === targetTab
    return (
      <button
        onClick={() => { setView('list'); setTab(targetTab) }}
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
        <Tile label="Today" value={counts.today} targetTab="appointments" />
        <Tile label="Upcoming" value={counts.upcoming} targetTab="appointments" />
        <Tile label="Pending" value={counts.pending} targetTab="pending" />
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
              ['appointments', 'Appointments', listAppointments.length],
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
      ) : (
        /* ── Appointments: browsable date-range + status list ── */
        <div className="space-y-4">
          {/* Filter bar — plain GET form; submitting re-queries server-side.
              Defaults to today → ~3 months ahead; move From back to see past. */}
          <form
            method="GET"
            action="/dashboard/scheduling"
            className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">From</label>
              <input type="date" name="from" defaultValue={filter.from}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">To</label>
              <input type="date" name="to" defaultValue={filter.to}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Status</label>
              <select name="status" defaultValue={filter.status}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'All statuses' : s === 'no_show' ? 'No-show' : s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm">Apply</Button>
            <Link href="/dashboard/scheduling" className="text-sm text-gray-500 hover:text-foreground">Reset</Link>
          </form>

          <ApptList items={listAppointments} emptyLabel="No appointments in this range." />
        </div>
      )}
    </main>
  )
}
