// app/dashboard/conversations/page.tsx
// WhatsApp AI conversation review — visible to all signed-in staff.
// The messaging controls panel above the list is admin-only.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getConversationThreads } from '@/app/actions/getConversations'
import { ConversationsView } from '@/components/ConversationsView'
import { AdminMessagingControls } from '@/components/AdminMessagingControls'

export default async function ConversationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin-only: decides whether the messaging controls panel renders.
  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin'

  const { threads, error } = await getConversationThreads()

  return (
    <main className="w-full py-2">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review the AI assistant's conversations with patients and leads.
        </p>
      </div>

      {isAdmin && <AdminMessagingControls />}

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <ConversationsView threads={threads ?? []} />
      )}
    </main>
  )
}
