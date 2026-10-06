'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type RebookRequest = {
  id: string
  patient_id: string | null
  patient_name: string
  phone_number: string
  requested_date: string | null
  requested_time: string | null
  service: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  patients: {
    id: string
    full_name: string
    file_number: string | null
  }[] | null
}

type Props = {
  requests: RebookRequest[]
}

export default function RebookingList({ requests }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectPanelId, setRejectPanelId] = useState<string | null>(null)

  // Form state for the approval panel
  const [approvalForm, setApprovalForm] = useState<{
    date: string
    time: string
    cancelPrevious: boolean
    note: string
  }>({
    date: '',
    time: '',
    cancelPrevious: true,
    note: '',
  })

  // Form state for the reject panel
  const [rejectForm, setRejectForm] = useState<{
    suggestedDate: string
    message: string
    internalNote: string
  }>({
    suggestedDate: '',
    message: '',
    internalNote: '',
  })

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  async function handleApprove(req: RebookRequest) {
    if (!approvalForm.date) {
      alert('Please set an appointment date before approving.')
      return
    }

    setLoadingId(req.id)
    try {
      // 1. Create appointment
      // Convert time from "09:00 AM" (12h) to "09:00" (24h) if needed, then
      // combine with date into a full timestamptz string.
      function to24h(timeStr: string): string {
        if (!timeStr) return '00:00'
        // Already 24h format (HH:mm from <input type="time">)
        if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr
        // Parse 12h AM/PM format
        const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
        if (!match) return '00:00'
        let hours = parseInt(match[1], 10)
        const mins = match[2]
        const meridiem = match[3].toUpperCase()
        if (meridiem === 'AM' && hours === 12) hours = 0
        if (meridiem === 'PM' && hours !== 12) hours += 12
        return `${String(hours).padStart(2, '0')}:${mins}`
      }

      const time24 = approvalForm.time ? to24h(approvalForm.time) : '00:00'
      const appointmentTimestamp = `${approvalForm.date}T${time24}:00`

      const { data: appt, error: apptErr } = await supabase
        .from('appointments')
        .insert({
          patient_id:       req.patient_id,
          appointment_date: appointmentTimestamp,
          service_type:     req.service ?? 'Follow-up visit',
          notes:            req.notes ?? 'Rebook via WhatsApp',
          status:           'booked',
        })
        .select('id')
        .single()

      if (apptErr || !appt) {
        console.error('Failed to create appointment:', apptErr)
        alert('Failed to create appointment. Please try again.')
        return
      }

      // 2. A reschedule REPLACES the patient's existing appointment(s).
      //    Cancel every other upcoming, non-cancelled appointment so the
      //    patient is left with exactly this new one. This also self-heals
      //    any duplicates that piled up from earlier approvals.
      if (approvalForm.cancelPrevious && req.patient_id) {
        const today = new Date().toISOString().split('T')[0]
        await supabase
          .from('appointments')
          .update({
            status:               'cancelled',
            cancelled_by_patient: true,
            cancellation_reason:  'Cancelled — replaced by rebook request',
            cancelled_at:         new Date().toISOString(),
          })
          .eq('patient_id', req.patient_id)
          .neq('id', appt.id) // keep the one we just made
          .gte('appointment_date', today)
          .not('status', 'in', '("cancelled","completed")')
      }

      // 3. Mark rebook request as approved
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staffRow } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('id', user?.id)
        .single()

      await supabase
        .from('rebook_requests')
        .update({
          status:          'approved',
          appointment_id:  appt.id,
          resolved_by:     staffRow?.id ?? null,
          resolved_at:     new Date().toISOString(),
          resolution_note: approvalForm.note || null,
        })
        .eq('id', req.id)

      // 4. Send WhatsApp confirmation to patient
      const formattedDate = new Date(approvalForm.date).toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })
      const formattedTime = approvalForm.time
        ? ` at ${approvalForm.time}`
        : ''
      const confirmMessage =
        `Hi ${req.patient_name}, your appointment at Olu Eye Clinic has been confirmed for ${formattedDate}${formattedTime}. ` +
        `Please arrive 10 minutes early. For enquiries call 09166015438. - Olu Eye Clinic`

      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: req.phone_number, message: confirmMessage }),
      })

      console.log(`✅ Rebook approved for ${req.patient_name}`)
      router.refresh()
    } catch (err) {
      console.error('Error approving rebook:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoadingId(null)
      setExpandedId(null)
      setApprovalForm({ date: '', time: '', cancelPrevious: false, note: '' })
    }
  }

  function openRejectPanel(req: RebookRequest) {
    setRejectPanelId(req.id)
    setExpandedId(null) // close approve panel if open
    // Pre-fill a sensible default message
    const dateHint = req.requested_date
      ? ` for ${formatDate(req.requested_date)}`
      : ''
    setRejectForm({
      suggestedDate: '',
      message: `Hi ${req.patient_name}, unfortunately we're unable to book you${dateHint}. ` +
        `Please call us on 09166015438 or suggest another date and we'll do our best to accommodate you.`,
      internalNote: '',
    })
  }

  async function handleReject(req: RebookRequest) {
    if (!rejectForm.message.trim()) return
    setLoadingId(req.id)
    try {
      // 1. Send WhatsApp reply to patient
      const sendRes = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: req.phone_number, message: rejectForm.message.trim() }),
      })
      if (!sendRes.ok) {
        const err = await sendRes.json()
        alert(`Failed to send WhatsApp message: ${err.error ?? 'unknown error'}`)
        return
      }

      // 2. Mark rebook request as rejected
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staffRow } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('id', user?.id)
        .single()

      await supabase
        .from('rebook_requests')
        .update({
          status:          'rejected',
          resolved_by:     staffRow?.id ?? null,
          resolved_at:     new Date().toISOString(),
          resolution_note: rejectForm.internalNote || rejectForm.message,
        })
        .eq('id', req.id)

      setRejectPanelId(null)
      setRejectForm({ suggestedDate: '', message: '', internalNote: '' })
      router.refresh()
    } catch (err) {
      console.error('Error rejecting rebook:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const statusBadge = (status: RebookRequest['status']) => {
    const map = {
      pending:   'bg-amber-100 text-amber-800',
      approved:  'bg-green-100 text-green-800',
      rejected:  'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg">No rebooking requests yet.</p>
        <p className="text-sm mt-1">When a registered patient asks Iris to reschedule, their request will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Pending ── */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pending ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(req => (
              <div
                key={req.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[#171717]">{req.patient_name}</span>
                        {req.patients?.[0]?.file_number && (
                          <span className="text-xs text-gray-400">#{req.patients[0].file_number}</span>
                        )}
                        {statusBadge(req.status)}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{req.phone_number}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {timeAgo(req.created_at)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Requested date</span>
                      <p className="font-medium text-[#171717]">{formatDate(req.requested_date)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Time preference</span>
                      <p className="font-medium text-[#171717]">{req.requested_time ?? 'Not specified'}</p>
                    </div>
                    {(req.service || req.notes) && (
                      <div className="col-span-2">
                        <span className="text-gray-400">Notes from patient</span>
                        <p className="font-medium text-[#171717]">{req.service ?? req.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setExpandedId(expandedId === req.id ? null : req.id)
                        setApprovalForm({
                          date: req.requested_date ?? '',
                          time: req.requested_time ?? '',
                          cancelPrevious: true,
                          note: '',
                        })
                      }}
                      className="px-4 py-1.5 bg-[#0d7b5f] text-white text-sm rounded-md hover:bg-[#0a6a50] transition-colors"
                    >
                      Approve & Book
                    </button>
                    <button
                      onClick={() => openRejectPanel(req)}
                      disabled={loadingId === req.id}
                      className="px-4 py-1.5 border border-gray-200 text-gray-600 text-sm rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <a
                      href={`/dashboard/patients/${req.patient_id}`}
                      className="ml-auto text-xs text-[#0d7b5f] hover:underline"
                    >
                      View patient →
                    </a>
                  </div>
                </div>

                {/* Reject panel (expandable) */}
                {rejectPanelId === req.id && (
                  <div className="border-t border-red-50 bg-red-50 px-5 py-4 space-y-4">
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                      Reject & reply to patient
                    </p>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Suggest an alternative date (optional)
                      </label>
                      <input
                        type="date"
                        value={rejectForm.suggestedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => {
                          const d = e.target.value
                          setRejectForm(f => {
                            const formattedDate = d
                              ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                              : ''
                            // Rebuild message with new date suggestion
                            const dateHint = req.requested_date ? ` for ${formatDate(req.requested_date)}` : ''
                            const altHint = formattedDate ? ` Would ${formattedDate} work for you instead?` : ''
                            return {
                              ...f,
                              suggestedDate: d,
                              message:
                                `Hi ${req.patient_name}, unfortunately we're unable to book you${dateHint}.${altHint} ` +
                                `For enquiries call 09166015438.`,
                            }
                          })
                        }}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Message to patient <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        rows={4}
                        value={rejectForm.message}
                        onChange={e => setRejectForm(f => ({ ...f, message: e.target.value }))}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">This is sent to the patient on WhatsApp.</p>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Internal note (optional, not sent)</label>
                      <input
                        type="text"
                        placeholder="e.g. Fully booked that week"
                        value={rejectForm.internalNote}
                        onChange={e => setRejectForm(f => ({ ...f, internalNote: e.target.value }))}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(req)}
                        disabled={loadingId === req.id || !rejectForm.message.trim()}
                        className="px-5 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {loadingId === req.id ? 'Sending…' : 'Send & Reject'}
                      </button>
                      <button
                        onClick={() => setRejectPanelId(null)}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Approval panel (expandable) */}
                {expandedId === req.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Confirm appointment details
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Appointment date *</label>
                        <input
                          type="date"
                          value={approvalForm.date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={e => setApprovalForm(f => ({ ...f, date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7b5f]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Appointment time</label>
                        <input
                          type="time"
                          value={approvalForm.time}
                          onChange={e => setApprovalForm(f => ({ ...f, time: e.target.value }))}
                          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7b5f]"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approvalForm.cancelPrevious}
                        onChange={e => setApprovalForm(f => ({ ...f, cancelPrevious: e.target.checked }))}
                        className="rounded border-gray-300 text-[#0d7b5f] focus:ring-[#0d7b5f]"
                      />
                      Cancel patient's previous upcoming appointment
                    </label>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Internal note (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Confirmed by phone call"
                        value={approvalForm.note}
                        onChange={e => setApprovalForm(f => ({ ...f, note: e.target.value }))}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7b5f]"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={loadingId === req.id || !approvalForm.date}
                        className="px-5 py-2 bg-[#0d7b5f] text-white text-sm rounded-md hover:bg-[#0a6a50] transition-colors disabled:opacity-50"
                      >
                        {loadingId === req.id ? 'Saving…' : 'Confirm & Create Appointment'}
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && (
        <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm">No pending requests — you're all caught up.</p>
        </div>
      )}

      {/* ── Resolved ── */}
      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Recent history
          </h2>
          <div className="space-y-2">
            {resolved.map(req => (
              <div
                key={req.id}
                className="bg-white border border-gray-100 rounded-lg px-5 py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <span className="font-medium text-sm text-[#171717]">{req.patient_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatDate(req.requested_date)}</span>
                  {req.resolution_note && (
                    <p className="text-xs text-gray-400 mt-0.5">{req.resolution_note}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {statusBadge(req.status)}
                  <span className="text-xs text-gray-400">{timeAgo(req.resolved_at ?? req.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
