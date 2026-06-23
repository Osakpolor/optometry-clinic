import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const SERVICES = [
  {
    name: 'Eye exam',
    badge: 'Most popular',
    description: 'A full check of your vision and eye health, including screening for common conditions such as glaucoma, cataracts, and macular degeneration.',
    duration: '45 min',
  },
  {
    name: 'Glasses fitting',
    badge: null,
    description: 'Personalised frame and lens selection based on your prescription, face shape, and lifestyle. Includes fitting and adjustment.',
    duration: '30 min',
  },
  {
    name: 'Contact lens fitting',
    badge: null,
    description: 'Measurement, trial lenses, and hands-on training for safe and comfortable contact lens wear. Includes follow-up check.',
    duration: '45 min',
  },
  {
    name: 'Follow-up visit',
    badge: null,
    description: 'A shorter check-in after a fitting, procedure, or prescription change to confirm everything is working well.',
    duration: '20 min',
  },
]

export default function ServicesPage() {
  return (
    <div>
      {/* Header */}
      <section className="border-b bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <h1 className="text-4xl font-semibold tracking-tight">Our services</h1>
          <p className="mt-3 max-w-xl text-gray-500">
            Comprehensive eye care for the whole family — from routine exams to specialist fittings.
          </p>
        </div>
      </section>

      {/* Services list */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col gap-4">
          {SERVICES.map(s => (
            <Card key={s.name} className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-medium">{s.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{s.duration}</span>
                    {s.badge && <Badge variant="secondary">{s.badge}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">{s.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-xl border bg-blue-50 px-8 py-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Ready to book?</h2>
          <p className="mt-2 text-sm text-gray-500">
            Choose your service and pick a time that works for you.
          </p>
          <Link href="/book">
            <Button className="mt-4 px-8">Book an appointment</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}