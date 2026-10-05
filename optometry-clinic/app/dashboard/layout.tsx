import { createClient } from '@/lib/supabase/server'
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

  const isAdmin = staffProfile?.role === 'admin'
  const isReceptionist = staffProfile?.role === 'receptionist'

  // Flash bar: only show for receptionist and admin
  let pendingRebookCount = 0
  if (isAdmin || isReceptionist) {
    const { count } = await supabase
      .from('rebook_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    pendingRebookCount = count ?? 0
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav isAdmin={isAdmin} isReceptionist={isReceptionist} />
      {(isAdmin || isReceptionist) && (
        <RebookFlashBar pendingCount={pendingRebookCount} />
      )}
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  )
}