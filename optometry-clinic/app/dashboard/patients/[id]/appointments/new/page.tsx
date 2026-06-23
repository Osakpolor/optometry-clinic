import NewAppointmentForm from '@/components/NewAppointmentForm'
import Link from 'next/link'

export default async function NewAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <main className="mx-auto max-w-lg p-8">
      <Link href={`/dashboard/patients/${id}`} className="text-sm text-muted-foreground hover:underline">
        ← Back to patient
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Book appointment slot</h1>
      <p className="mt-1 text-sm text-muted-foreground">Schedule an appointment for this patient.</p>
      <NewAppointmentForm patientId={id} />
    </main>
  )
}