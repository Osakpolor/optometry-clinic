import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function PatientsPage() {
  const supabase = await createClient()

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, email, created_at')
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-semibold">Patients</h1>
      {error && <p className="mt-4 text-red-600">Error: {error.message}</p>}
      {!error && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Phone</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {patients?.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{p.full_name}</td>
                <td className="py-2 pr-4">{p.phone}</td>
                <td className="py-2 pr-4">{p.email ?? '—'}</td>
                <td className="py-2 pr-4">
                  <Link href={`/dashboard/patients/${p.id}`} className="text-blue-600 underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}