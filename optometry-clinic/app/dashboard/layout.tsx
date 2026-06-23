import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b border-gray-200">
        <nav className="mx-auto flex max-w-4xl items-center justify-between p-4 text-sm">
          <div className="flex gap-6">
            <Link href="/dashboard" className="font-medium hover:underline">
            Appointments
            </Link>
            <Link href="/dashboard/patients" className="hover:underline text-gray-600">
              Patients
            </Link>
          </div>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  )
}