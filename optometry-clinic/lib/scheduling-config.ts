// ─────────────────────────────────────────────────────────────────────────
// Central, tunable scheduling config. Everything here is a deliberate GUESS
// until the clinic sees real walk-in volume — change the numbers in THIS file
// and nowhere else. Nothing below is hardcoded inline in the calendar UI.
// ─────────────────────────────────────────────────────────────────────────

// The clinic's physical timezone. Occupancy is always counted by the LOCAL
// calendar day here, never UTC, so an appointment can't land off-by-one.
// Africa/Lagos is UTC+1 year-round (no DST).
export const CLINIC_TIMEZONE = 'Africa/Lagos'

// Days the clinic is CLOSED, as weekday numbers (0 = Sunday … 6 = Saturday).
// Confirmed by the clinic: closed Sundays only. To change later, edit this
// array — e.g. [0, 6] for Sun + Sat.
export const CLOSED_WEEKDAYS: number[] = [0]

// Day-level occupancy heat thresholds — counts of ACTIVE appointments on a day.
// GUESS until real volume is seen; trivially tunable here.
//   1–GREEN_MAX   → open    (green)
//   …–AMBER_MAX   → filling (amber)
//   AMBER_MAX+1 + → full    (red)
export const OCCUPANCY = {
  GREEN_MAX: 5,
  AMBER_MAX: 10,
} as const

// Statuses that COUNT toward a day's occupancy. Cancelled, completed and
// no_show are deliberately excluded so they never inflate the heat (a day full
// of cancelled appointments must read as empty, not red).
export const ACTIVE_STATUSES = ['booked', 'confirmed'] as const

export type HeatLevel = 'empty' | 'open' | 'filling' | 'full'

export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 'empty'
  if (count <= OCCUPANCY.GREEN_MAX) return 'open'
  if (count <= OCCUPANCY.AMBER_MAX) return 'filling'
  return 'full'
}

// ── Local-day grouping ──────────────────────────────────────────────────────
// Appointments are stored at NOON (see appointmentActions.dayTimestamp:
// `${date}T12:00:00`), written into a timestamptz column so they come back as
// an absolute instant (noon UTC). Rendering that instant in CLINIC_TIMEZONE
// yields the intended booking day — noon is far enough from midnight that the
// ±1h offset can never push it to an adjacent day. Doing it in the zone (rather
// than slicing the UTC string) also handles any legacy row with a real time.
const _dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Returns the clinic-local calendar day for a DB timestamp, as "YYYY-MM-DD",
// or "" when the value is missing or unparseable.
//
// This MUST NOT throw: a single malformed row would otherwise crash the whole
// Scheduling render (a real incident — two legacy appointments had typo'd
// 5-digit years like "82026-02-10", which Postgres stores happily but JS
// `new Date()` rejects, and Intl.formatToParts throws "Invalid time value" on).
// An unparseable date returns "" so it simply never matches a calendar day.
export function clinicDay(value: string | null | undefined): string {
  if (!value) return ''

  // Normalise: a date-only value gets noon; a naive timestamp (no offset) is
  // treated as UTC so server (UTC) and browser (any zone) agree before the
  // conversion to Lagos.
  let s = value
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s = `${s}T12:00:00Z`
  else if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s = `${s}Z`

  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''

  const parts = _dayFmt.formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value ?? ''
  const m = parts.find(p => p.type === 'month')?.value ?? ''
  const dd = parts.find(p => p.type === 'day')?.value ?? ''
  if (!y || !m || !dd) return ''
  return `${y}-${m}-${dd}`
}

// Today's date in the clinic's timezone, as "YYYY-MM-DD".
export function clinicToday(): string {
  return clinicDay(new Date().toISOString())
}
