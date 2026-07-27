'use client'

// components/ConversationsView.tsx
// Read-only WhatsApp AI conversation viewer. Left: list of threads.
// Right: the selected thread as a chat transcript. Staff can review what
// the AI has said to patients. No replying (Level 1 — passive review).

import { useState } from 'react'
import Link from 'next/link'
import type { ConversationThread } from '@/app/actions/getConversations'
import { getConversationMessages } from '@/app/actions/getConversations'

function timeLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ConversationsView({ threads }: { threads: ConversationThread[] }) {
  const [selected, setSelected] = useState<ConversationThread | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function openThread(t: ConversationThread) {
    setSelected(t)
    setLoading(true)
    const result = await getConversationMessages(t.phoneNumber)
    setLoading(false)
    setMessages(result.messages ?? [])
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[400px]">
      {/* Thread list */}
      <div className="border border-border rounded-lg overflow-y-auto bg-white">
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">No conversations yet.</p>
        ) : (
          <ul className="divide-y">
            {threads.map(t => (
              <li key={t.phoneNumber}>
                <button
                  onClick={() => openThread(t)}
                  className={`w-full text-left px-3 py-3 hover:bg-gray-50 transition-colors ${
                    selected?.phoneNumber === t.phoneNumber ? 'bg-brand/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{t.displayName}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{timeLabel(t.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.kind === 'patient' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">Patient</span>}
                    {t.kind === 'lead' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Lead</span>}
                    {t.kind === 'unknown' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">Unknown</span>}
                    <span className="text-xs text-muted-foreground truncate">{t.lastMessagePreview}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transcript */}
      <div className="border border-border rounded-lg bg-white flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a conversation to view the transcript.
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b shrink-0 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{selected.displayName}</div>
                <div className="text-xs text-muted-foreground">{selected.phoneNumber}</div>
              </div>
              {selected.patientId && (
                <Link
                  href={`/dashboard/patients/${selected.patientId}`}
                  className="text-xs text-brand underline hover:no-underline"
                >
                  Open patient record →
                </Link>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-gray-50/50">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
              ) : (
                messages.map(m => {
                  const isUser = m.role === 'user'
                  return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                        isUser
                          ? 'bg-white border border-gray-200 rounded-tl-sm'
                          : 'bg-green-600 text-white rounded-tr-sm'
                      }`}>
                        <div>{m.message}</div>
                        <div className={`text-[10px] mt-1 ${isUser ? 'text-gray-400' : 'text-green-100'}`}>
                          {isUser ? 'Patient' : 'AI'} · {timeLabel(m.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t shrink-0 bg-gray-50">
              <p className="text-[11px] text-muted-foreground text-center">
                Read-only view of the AI assistant's conversations. Replying from here is not yet enabled.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
