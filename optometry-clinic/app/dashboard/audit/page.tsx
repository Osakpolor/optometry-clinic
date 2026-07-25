// app/dashboard/audit/page.tsx

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole, canViewAudit } from '@/lib/auth/roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter } = await searchParams
  const activeFilter = filter ?? 'DELETE' // default view: deletions

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole()
  if (!canViewAudit(role)) redirect('/dashboard')

  // Fetch audit entries, joined with the acting staff member's name.
  let query = supabase
    .from('audit_log')
    .select('id, action, table_name, record_id, patient_id, created_at, details, staff_profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (activeFilter !== 'ALL') {
    query = query.eq('action', activeFilter)
  }

  const { data: entries } = await query

  const filters = [
    { key: 'DELETE', label: 'Deletions' },
    { key: 'INSERT', label: 'Created' },
    { key: 'UPDATE', label: 'Edits' },
    { key: 'ALL', label: 'All activity' },
  ]

  const actionColors: Record<string, string> = {
    DELETE: 'bg-red-50 text-red-700 border-red-200',
    INSERT: 'bg-green-50 text-green-700 border-green-200',
    UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  }

  function actionLabel(a: string) {
    if (a === 'DELETE') return 'Deleted'
    if (a === 'INSERT') return 'Created'
    if (a === 'UPDATE') return 'Edited'
    return a
  }

  return (
    <main className="w-full py-2">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit trail</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A record of clinical data changes. Deletions show a snapshot of what was removed.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {filters.map(f => (
          <Link
            key={f.key}
            href={`/dashboard/audit?filter=${f.key}`}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              activeFilter === f.key
                ? 'bg-brand text-white border-brand'
                : 'border-border text-muted-foreground hover:border-brand/40'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            {filters.find(f => f.key === activeFilter)?.label ?? 'Activity'}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {entries?.length ?? 0} {entries?.length === 1 ? 'entry' : 'entries'}
            </span>
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          {entries && entries.length > 0 ? (
            <ul className="flex flex-col divide-y">
              {entries.map((e: any) => {
                const d = e.details ?? {}
                const staffName =
                  e.staff_profiles?.full_name ?? d.deleted_by_name ?? 'Unknown staff'
                const when = new Date(e.created_at).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
                return (
                  <li key={e.id} className="py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${actionColors[e.action] ?? ''}`}
                          >
                            {actionLabel(e.action)}
                          </Badge>
                          <span className="text-sm font-medium">{staffName}</span>
                          <span className="text-xs text-muted-foreground">
                            · {e.table_name?.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Deletion snapshot detail */}
                        {e.action === 'DELETE' && (d.patient_name || d.diagnosis || d.visit_date) && (
                          <p className="text-sm text-gray-600 mt-1.5">
                            {d.patient_name && (
                              <>Visit for <span className="font-medium">{d.patient_name}</span></>
                            )}
                            {d.file_number && <> (File #{d.file_number})</>}
                            {d.visit_date && (
                              <> dated {new Date(d.visit_date).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}</>
                            )}
                            {d.diagnosis && <>, diagnosis: {d.diagnosis}</>}
                          </p>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {when}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No {activeFilter === 'ALL' ? '' : actionLabel(activeFilter).toLowerCase()} activity recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
