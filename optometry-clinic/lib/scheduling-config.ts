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
// Default: closed Sundays. TODO(owner): confirm the real closed day(s) and
// edit this array — e.g. [0] Sun only, or [0, 6] for Sun + Sat.
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

// Returns the clinic-local calendar day for a DB timestamp, as "YYYY-MM-DD".
export function clinicDay(value: string): string {
  // Guard against a bare `timestamp` (no offset): treat it as UTC so the server
  // (UTC) and the browser (any zone) always agree before converting to Lagos.
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  const parts = _dayFmt.formatToParts(new Date(hasTz ? value : `${value}Z`))
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

// Today's date in the clinic's timezone, as "YYYY-MM-DD".
export function clinicToday(): string {
  return clinicDay(new Date().toISOString())
}
