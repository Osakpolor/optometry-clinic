import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const SERVICES = [
  { name: 'Eye exam', description: 'Comprehensive vision and eye health checks including screening for common conditions.', badge: 'Most popular' },
  { name: 'Glasses fitting', description: 'Personalised frame and lens selection based on your prescription and lifestyle.' , badge: null },
  { name: 'Contact lens fitting', description: 'Measurement, trial lenses, and hands-on training for comfortable contact lens wear.', badge: null },
  { name: 'Follow-up visit', description: 'Check-ins after a procedure, fitting, or prescription change.', badge: null },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-blue-50 to-white">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <Badge variant="outline" className="mb-4 text-blue-600 border-blue-200 bg-blue-50">
            Now accepting new patients
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900">
            Clear vision starts here
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
            Comprehensive eye exams, glasses, and contact lens fittings — book an appointment in minutes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/book">
              <Button size="lg" className="px-8">Book an appointment</Button>
            </Link>
            <Link href="/services">
              <Button size="lg" variant="outline" className="px-8">Our services</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Our services</h2>
        <p className="mt-2 text-gray-500">Everything you need for your eye health, in one place.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SERVICES.map(s => (
            <Card key={s.name} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">{s.name}</CardTitle>
                  {s.badge && <Badge variant="secondary" className="text-xs">{s.badge}</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{s.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/services">
            <Button variant="outline">See full services list</Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Ready to book?</h2>
          <p className="mt-2 text-gray-500">Choose a time that works for you — it only takes a minute.</p>
          <Link href="/book">
            <Button size="lg" className="mt-6 px-10">Book appointment</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}