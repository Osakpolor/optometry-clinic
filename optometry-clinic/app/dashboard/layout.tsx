import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/DashboardNav'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav isAdmin={isAdmin} />
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  )
}
