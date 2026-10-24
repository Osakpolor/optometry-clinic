import { createClient } from '@/lib/supabase/server'
import { canManageAppointments } from '@/lib/auth/roles'
import DashboardNav from '@/components/DashboardNav'
import RebookFlashBar from '@/components/rebooking/RebookFlashBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: staffProfile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const role = staffProfile?.role ?? null
  const isAdmin = role === 'admin'
  // One shared rule: anyone who can manage appointments gets the Scheduling
  // link and the pending-reschedule flash bar (admin / doctor / receptionist).
  const canSchedule = canManageAppointments(role)

  let pendingRebookCount = 0
  if (canSchedule) {
    const { count } = await supabase
      .from('rebook_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    pendingRebookCount = count ?? 0
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav isAdmin={isAdmin} canSchedule={canSchedule} />
      {canSchedule && (
        <RebookFlashBar pendingCount={pendingRebookCount} />
      )}
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  )
}