import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { SendToAll } from '@/components/broadcasts/SendToAll'
import { BroadcastFunnel, type BroadcastRow } from '@/components/broadcasts/BroadcastFunnel'
import { wsdHeaderImageUrl } from '@/lib/broadcast-campaign'

export const dynamic = 'force-dynamic'

export default async function BroadcastsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentStaff } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentStaff?.role !== 'admin') {
    return (
      <main className="w-full py-2">
        <p className="text-sm text-red-500">
          Access denied. Only admins can send broadcasts.
        </p>
      </main>
    )
  }

  // Live recipient count: active, non-opted-out patients. head:true returns only
  // the count, so it is unaffected by the 1000-row PostgREST read cap.
  const { count } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .eq('marketing_opted_out', false)

  const recipientCount = count ?? 0
  const imageUrl = wsdHeaderImageUrl()

  // Recent broadcasts with their delivery counts (admin-readable via RLS).
  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select(
      'id, title, status, total_count, sent_count, delivered_count, read_count, failed_count, capped_count, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="w-full py-2">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
        ← Dashboard
      </Link>

      <div className="mt-4 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Broadcasts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send the World Sight Day campaign to patients.
          </p>
        </div>
        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
          Admin only
        </Badge>
      </div>

      <Card className="border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            World Sight Day — free eye test
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Template <code>wsd_free_eye_test_oct10_v3</code> · personalised first name · image header.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="px-5 pt-5 pb-6">
          <SendToAll recipientCount={recipientCount} imageUrl={imageUrl} />
        </CardContent>
      </Card>

      <Card className="mt-6 border border-border shadow-none">
        <CardHeader className="px-5 pt-5 pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Recent broadcasts — delivery
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each recipient appears in one stage (its latest status); Delivered and Read update as
            Meta confirms receipts.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="px-5 pt-5 pb-6">
          {broadcasts && broadcasts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {(broadcasts as BroadcastRow[]).map((b) => (
                <BroadcastFunnel key={b.id} b={b} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
