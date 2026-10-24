import { redirect } from 'next/navigation'

// Retired — patient-initiated reschedule requests now live in the Scheduling
// hub (/dashboard/scheduling) as the "Reschedule requests" queue on the default
// view. Kept as a redirect so old bookmarks/links don't 404.
export default function RebookingPage() {
  redirect('/dashboard/scheduling')
}
