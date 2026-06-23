'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function SiteNav() {
  const pathname = usePathname()
  if (pathname.startsWith('/dashboard')) return null

  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-4xl items-center justify-between p-4 text-sm">
        <Link href="/" className="font-semibold">
          Clearview Optical
        </Link>
        <div className="flex gap-6">
          <Link href="/services" className="hover:underline">Services</Link>
          <Link href="/book" className="hover:underline">Book appointment</Link>
          <Link href="/login" className="text-gray-500 hover:underline">Staff login</Link>
        </div>
      </nav>
    </header>
  )
}