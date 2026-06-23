'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Lead = {
  id: string
  full_name: string
  phone: string
  email: string | null
  service_interest: string | null
  status: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  contacted: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  converted: 'bg-gray-50 text-gray-500 border-gray-200',
  lost: 'bg-red-50 text-red-400 border-red-100',
}

const STATUSES = ['new', 'contacted', 'confirmed', 'converted', 'lost']

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [updating, setUpdating] = useState<string | null>(null)

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    await supabase.from('leads').update({ status }).eq('id', id)
    setUpdating(null)
    router.refresh()
  }

  if (!leads.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No leads yet.</p>
  }

  return (
    <div className="flex flex-col divide-y">
      {leads.map(lead => (
        <div key={lead.id} className="py-3 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium">{lead.full_name}</span>
            <span className="text-xs text-muted-foreground">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</span>
            {lead.service_interest && (
              <span className="text-xs text-muted-foreground">{lead.service_interest}</span>
            )}
            <span className="text-xs text-gray-300">
              {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[lead.status]}`}>
              {lead.status}
            </Badge>
            <select
              value={lead.status}
              disabled={updating === lead.id}
              onChange={e => updateStatus(lead.id, e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  )
}