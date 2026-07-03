'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, File, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'


type StorageFile = {
  name: string
  id: string | null
  updated_at: string
  created_at: string
  metadata: {
    size: number
    mimetype: string
  }
}

type Props = {
  patientId: string
}

function FileIcon({ mimetype }: { mimetype: string }) {
  if (mimetype?.includes('pdf')) {
    return <File className="w-4 h-4 text-red-500 shrink-0" />
  }
  return <FileText className="w-4 h-4 text-blue-500 shrink-0" />
}

function formatFileSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export default function PatientDocuments({ patientId }: Props) {
  const supabase = createClient()
  const [files, setFiles] = useState<StorageFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    async function loadFiles() {
      setLoading(true)
      const { data, error } = await supabase.storage
        .from('patient-documents')
        .list(patientId, {
          limit: 200,
          sortBy: { column: 'name', order: 'asc' }
        })

      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }
      // Filter out placeholder/folder entries
      setFiles((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder') as StorageFile[])
    }

    loadFiles()
  }, [patientId])

  async function handleDownload(fileName: string) {
    setDownloading(fileName)
    const { data, error } = await supabase.storage
      .from('patient-documents')
      .createSignedUrl(`${patientId}/${fileName}`, 60)

    setDownloading(null)

    if (error || !data?.signedUrl) {
      alert('Could not generate download link. Please try again.')
      return
    }

    // Open in new tab — browser will handle download or preview
    window.open(data.signedUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading documents…
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 py-2">
        Could not load documents: {error}
      </p>
    )
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No legacy documents on file for this patient.
      </p>
    )
  }

  // Separate PDFs from Word docs for cleaner display
  const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'))
  const docs = files.filter(f => !f.name.toLowerCase().endsWith('.pdf'))

  return (
    <div className="flex flex-col gap-1">
      {[...docs, ...pdfs].map(file => (
        <div
          key={file.id ?? file.name}
          className="flex items-center justify-between py-2.5 border-b
                     border-gray-50 last:border-0 gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FileIcon mimetype={file.metadata?.mimetype ?? ''} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.metadata?.size)} · {formatDate(file.created_at)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs h-7"
            onClick={() => handleDownload(file.name)}
            disabled={downloading === file.name}
          >
            {downloading === file.name ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Download className="w-3 h-3 mr-1" />
                Open
              </>
            )}
          </Button>
        </div>
      ))}
      <p className="text-xs text-muted-foreground mt-2">
        {files.length} file{files.length !== 1 ? 's' : ''} —
        {' '}legacy records from the clinic's physical files.
        {' '}Click Open to view or download.
      </p>
    </div>
  )
}
