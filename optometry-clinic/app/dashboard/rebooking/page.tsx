import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/auth/roles'
import RebookingList from '@/components/rebooking/RebookingList'

export const dynamic = 'force-dynamic'

export default async function RebookingPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole(supabase, user.id)

  // Only receptionist and admin can access this page
  if (role !== 'receptionist' && role !== 'admin') {
    redirect('/dashboard')
  }

  // Load pending + recently resolved rebook requests
  const { data: requests, error } = await supabase
    .from('rebook_requests')
    .select(`
      id,
      patient_id,
      patient_name,
      phone_number,
      requested_date,
      requested_time,
      service,
      notes,
      status,
      resolution_note,
      resolved_at,
      created_at,
      patients (
        id,
        full_name,
        file_number
      )
    `)
    .in('status', ['pending', 'approved', 'rejected', 'cancelled'])
    .order('status', { ascending: true }) // pending first
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error loading rebook requests:', error)
  }

  // Load appointments for the approval dropdown
  // We need to create a new appointment when receptionist approves
  const pendingCount = (requests ?? []).filter(r => r.status === 'pending').length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#171717]">Rebooking Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          WhatsApp rescheduling requests from registered patients.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <RebookingList requests={requests ?? []} />
    </div>
  )
}