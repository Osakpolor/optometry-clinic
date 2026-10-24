'use client'

import { useMemo, useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  clinicDay,
  heatLevel,
  CLOSED_WEEKDAYS,
  type HeatLevel,
} from '@/lib/scheduling-config'
import { bookAppointment } from '@/app/actions/appointmentActions'
import { searchPatients, type PatientHit } from '@/app/actions/patientSearch'

type CalItem = {
  id: string
  patientId: string | null
  patientName: string
  date: string
  serviceType: string | null
  status: string
}

type Props = {
  appointments: CalItem[] // ACTIVE only (booked/confirmed) — see the page query
  todayStr: string        // clinic-local YYYY-MM-DD
  canManage: boolean
}

const SERVICES = ['Eye exam', 'Glasses fitting', 'Contact lens fitting', 'Follow-up visit']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// State-only colour (see claude/engineering-standards.md § Colour discipline).
// booked = common/default → neutral; confirmed = success → green.
// NB: this is the day-detail status pill, NOT the occupancy heat scale below —
// the heat (green/amber/red by count) encodes a value and is left as-is.
const STATUS_PILL: Record<string, string> = {
  booked:    'bg-gray-100 text-gray-700 border-gray-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
}

// Heat colours for a day cell. These map to the levels defined by the
// thresholds in scheduling-config.ts — tune the thresholds there, not here.
const HEAT: Record<HeatLevel, string> = {
  empty:   'bg-white border-gray-200',
  open:    'bg-green-50 border-green-200',
  filling: 'bg-amber-50 border-amber-200',
  full:    'bg-red-50 border-red-200',
}

function pad(n: number) { return String(n).padStart(2, '0') }

// Weekday (0=Sun) of a clinic calendar date, computed off the plain Y-M-D so
// no timezone can shift it.
function weekdayOf(y: number, m0: number, day: number): number {
  return new Date(Date.UTC(y, m0, day)).getUTCDay()
}

function labelForDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

export default function CalendarView({ appointments, todayStr, canManage }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [ty, tm] = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number)
    return [y, m - 1] // month 0-indexed
  }, [todayStr])

  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: ty, m: tm })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  // Occupancy per local day. Everything passed in is already active-only, so a
  // plain tally is the occupancy count.
  const countByDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of appointments) {
      const d = clinicDay(a.date)
      map[d] = (map[d] ?? 0) + 1
    }
    return map
  }, [appointments])

  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
  const firstWeekday = weekdayOf(cursor.y, cursor.m, 1)
  const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate()

  function stepMonth(delta: number) {
    setSelectedDay(null)
    setCursor(c => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1))
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
    })
  }
  function goToday() {
    setSelectedDay(null)
    setCursor({ y: ty, m: tm })
  }

  const selectedList = selectedDay
    ? appointments.filter(a => clinicDay(a.date) === selectedDay)
    : []

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#171717]">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => stepMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => stepMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map(w => (
          <div key={w} className="py-1 text-center text-xs font-medium text-gray-400">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`blank-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${cursor.y}-${pad(cursor.m + 1)}-${pad(day)}`
          const closed = CLOSED_WEEKDAYS.includes(weekdayOf(cursor.y, cursor.m, day))
          const count = countByDay[dateStr] ?? 0
          const level = closed ? 'empty' : heatLevel(count)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDay

          if (closed) {
            return (
              <div
                key={dateStr}
                className={cn(
                  'flex min-h-[64px] flex-col rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5',
                  isToday && 'ring-2 ring-brand ring-inset'
                )}
              >
                <span className="text-xs font-medium text-gray-400">{day}</span>
                <span className="mt-auto text-[10px] uppercase tracking-wide text-gray-400">Closed</span>
              </div>
            )
          }

          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(isSelected ? null : dateStr)}
              className={cn(
                'flex min-h-[64px] flex-col rounded-md border px-2 py-1.5 text-left transition-colors hover:border-brand/50',
                HEAT[level],
                isToday && 'ring-2 ring-brand ring-inset',
                isSelected && 'ring-2 ring-brand/70'
              )}
            >
              <span className={cn('text-xs font-medium', isToday ? 'text-brand' : 'text-gray-600')}>{day}</span>
              {count > 0 && (
                <span className="mt-auto text-sm font-semibold text-[#171717]">
                  {count}
                  <span className="ml-1 text-[10px] font-normal text-gray-500">
                    {count === 1 ? 'appt' : 'appts'}
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
        <LegendSwatch className="bg-green-50 border-green-200" label="Open (1–5)" />
        <LegendSwatch className="bg-amber-50 border-amber-200" label="Filling (6–10)" />
        <LegendSwatch className="bg-red-50 border-red-200" label="Full (11+)" />
        <LegendSwatch className="bg-gray-50 border-gray-200" label="Closed" />
      </div>

      {/* Day-detail panel */}
      {selectedDay && (
        <DayPanel
          dateStr={selectedDay}
          items={selectedList}
          canManage={canManage && selectedDay >= todayStr}
          isPast={selectedDay < todayStr}
          isPending={isPending}
          onClose={() => setSelectedDay(null)}
          onBook={(patientId, serviceType, note) => {
            startTransition(async () => {
              const res = await bookAppointment(patientId, { date: selectedDay, serviceType, note })
              if (res.error) { toast.error(res.error); return }
              toast.success(`Appointment booked for ${labelForDay(selectedDay)}.`)
              router.refresh()
            })
          }}
        />
      )}
    </div>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-3 w-3 rounded border', className)} />
      {label}
    </span>
  )
}

// ── Day-detail panel: read-only list + the reused, audited booking flow ──────
function DayPanel({
  dateStr, items, canManage, isPast, isPending, onClose, onBook,
}: {
  dateStr: string
  items: CalItem[]
  canManage: boolean
  isPast: boolean
  isPending: boolean
  onClose: () => void
  onBook: (patientId: string, serviceType: string, note: string) => void
}) {
  const [booking, setBooking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatientHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PatientHit | null>(null)
  const [service, setService] = useState(SERVICES[0])
  const [note, setNote] = useState('')

  // Debounced typeahead against the guarded searchPatients action.
  useEffect(() => {
    if (selected) return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let active = true
    setSearching(true)
    const t = setTimeout(async () => {
      const res = await searchPatients(q)
      if (!active) return
      setResults(res.results)
      setSearching(false)
    }, 300)
    return () => { active = false; clearTimeout(t) }
  }, [query, selected])

  function resetBooking() {
    setBooking(false); setQuery(''); setResults([]); setSelected(null)
    setService(SERVICES[0]); setNote('')
  }

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#171717]">{labelForDay(dateStr)}</h3>
          <p className="text-xs text-gray-500">
            {items.length === 0 ? 'No appointments' : `${items.length} appointment${items.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Appointment list (read-only — manage from the List view) */}
      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <Link
                  href={a.patientId ? `/dashboard/patients/${a.patientId}` : '#'}
                  className="text-sm font-medium text-[#171717] hover:text-brand hover:underline"
                >
                  {a.patientName}
                </Link>
                <p className="text-xs text-gray-500 truncate">{a.serviceType ?? 'Appointment'}</p>
              </div>
              <span className={cn(
                'shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize',
                STATUS_PILL[a.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
              )}>
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Book on this day */}
      <div className="mt-4">
        {isPast ? (
          <p className="text-xs text-gray-400">This day has passed — bookings can only be made for today or later.</p>
        ) : !canManage ? null : !booking ? (
          <Button size="sm" onClick={() => setBooking(true)}>Book on this day</Button>
        ) : (
          <div className="space-y-3 rounded-md border border-brand/20 bg-brand/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">Book on this day</p>

            {/* Patient picker */}
            {selected ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#171717]">{selected.full_name ?? 'Unnamed'}</p>
                  <p className="text-xs text-gray-500">
                    {selected.file_number ? `#${selected.file_number}` : selected.phone ?? ''}
                  </p>
                </div>
                <Button size="xs" variant="ghost" onClick={() => { setSelected(null); setQuery('') }}>Change</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Find patient</Label>
                <Input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Name or file number"
                  className="text-sm"
                />
                {query.trim().length >= 2 && (
                  <div className="max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
                    {searching ? (
                      <p className="px-3 py-2 text-xs text-gray-400">Searching…</p>
                    ) : results.length ? (
                      results.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelected(p)}
                          className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 text-left last:border-0 hover:bg-gray-50"
                        >
                          <span className="text-sm text-[#171717]">{p.full_name ?? 'Unnamed'}</span>
                          <span className="text-xs text-gray-400">{p.file_number ? `#${p.file_number}` : p.phone ?? ''}</span>
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-gray-400">No matches.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reason + note */}
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
              <Label className="text-xs">Note <span className="font-normal text-gray-400">optional</span></Label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the front desk should know" className="text-sm" />
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!selected || isPending}
                onClick={() => { if (selected) onBook(selected.id, service, note) }}
              >
                {isPending ? 'Booking…' : 'Book appointment'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetBooking} disabled={isPending}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
