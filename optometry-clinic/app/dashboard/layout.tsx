import SignOutButton from '@/components/SignOutButton'
import Link from 'next/link'
import { Separator } from '@/components/ui/separator'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-background sticky top-0 z-10 border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">Olu Eye Clinic</span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-5 text-sm">
              <Link href="/dashboard" className="text-foreground font-medium hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/patients" className="text-muted-foreground hover:text-foreground transition-colors">
                Patients
              </Link>
            </div>
          </div>
          <SignOutButton />
        </nav>
      </header>
      {children}
    </div>
  )
}