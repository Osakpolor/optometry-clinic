import { redirect } from 'next/navigation'

// Retired — the Scheduling hub (/dashboard/scheduling) now covers the whole
// appointment book (browsable date-range + status, per-row status control).
// Kept as a redirect so old bookmarks/links don't 404.
export default function AppointmentsPage() {
  redirect('/dashboard/scheduling')
}
