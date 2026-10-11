// components/broadcasts/BroadcastFunnel.tsx
// Presentational delivery funnel for one broadcast. Counts are exact-status
// (each recipient sits in one stage = its latest status), so they sum to the
// total. Server-rendered; no client interactivity.
import { Badge } from '@/components/ui/badge'

export type BroadcastRow = {
  id: string
  title: string
  status: string
  total_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  capped_count: number
  created_at: string
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center">
      <p className={`text-base font-semibold ${tone}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

export function BroadcastFunnel({ b }: { b: BroadcastRow }) {
  const known =
    b.sent_count + b.delivered_count + b.read_count + b.failed_count + b.capped_count
  const remaining = Math.max(0, b.total_count - known) // queued + skipped (no columns for those)
  const date = new Date(b.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{b.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {date} · {b.total_count.toLocaleString()} recipients
          </p>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {b.status}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Sent" value={b.sent_count} tone="text-gray-700" />
        <Stat label="Delivered" value={b.delivered_count} tone="text-gray-900" />
        <Stat label="Read" value={b.read_count} tone="text-brand" />
        <Stat label="Failed" value={b.failed_count} tone="text-destructive" />
        <Stat label="Capped" value={b.capped_count} tone="text-amber-700" />
        <Stat label="Queued/skipped" value={remaining} tone="text-muted-foreground" />
      </div>
    </div>
  )
}
