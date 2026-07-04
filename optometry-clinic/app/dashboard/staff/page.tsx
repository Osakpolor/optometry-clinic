import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { InviteStaffForm } from '@/components/staff/InviteStaffForm'
import { StaffList } from '@/components/staff/StaffList'
import Link from 'next/link'

export default async function StaffPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check role using regular client (user can see their own row)
  const { data: currentStaff } = await supabase
    .from('staff_profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (currentStaff?.role !== 'admin') {
    return (
      <main className="w-full py-2">
        <p className="text-sm text-red-500">
          Access denied. Only admins can manage staff.
        </p>
      </main>
    )
  }

  // Use admin client to bypass RLS and fetch ALL staff
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: staffMembers } = await adminClient
    .from('staff_profiles')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: true })

  const activeCount = staffMembers?.filter(s => s.is_active).length ?? 0
  const totalCount = staffMembers?.length ?? 0

  return (
    <main className="w-full py-2">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Dashboard
      </Link>

      {/* Page header */}
      <div className="mt-4 mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Staff management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} active · {totalCount} total
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs bg-amber-50 text-amber-700 border-amber-200"
        >
          Admin only
        </Badge>
      </div>

      <div className="flex flex-col gap-6">
        {/* Invite new staff */}
        <Card className="border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Invite new staff member
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              They will receive an email with a link to set their password
              and access the dashboard.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 pt-5 pb-6">
            <InviteStaffForm />
          </CardContent>
        </Card>

        {/* Staff list */}
        <Card className="border border-border shadow-none">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Current staff
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 pt-4 pb-5">
            <StaffList
              staffMembers={staffMembers ?? []}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}