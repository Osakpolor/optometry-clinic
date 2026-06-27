import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white sticky top-0 z-10 border-b shadow-sm">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-8 py-3">
          <div className="flex items-center gap-3 sm:gap-6">
            <span className="font-bold text-base sm:text-lg">Olu Eye Clinic</span>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            <div className="flex gap-3 sm:gap-5 text-sm">
              <Link href="/dashboard" className="text-foreground font-medium hover:text-brand transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/patients" className="text-muted-foreground hover:text-foreground transition-colors">
                Patients
              </Link>
              <Link href="/dashboard/appointments" className="text-muted-foreground hover:text-foreground transition-colors">
                Appointments
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/patients/new">
              <Button size="sm" className="hidden sm:flex">
                + New patient
              </Button>
            </Link>
            <SignOutButton />
          </div>
        </nav>
      </header>

      {/* 
        This single wrapper controls ALL dashboard page widths.
        Individual pages should NOT set their own max-width.
      */}
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-8">
        {children}
      </div>
    </div>
  )
}