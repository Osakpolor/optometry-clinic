'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, File, Download, Loader2, Upload, X } from 'lucide-react'
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

// Accepted upload types: images, Word, PDF, Excel
const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,' +
  'image/*,application/pdf,' +
  'application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const MAX_MB = 25 // per-file guard

function FileIcon({ name, mimetype }: { name: string; mimetype: string }) {
  const lower = name.toLowerCase()
  if (mimetype?.includes('pdf') || lower.endsWith('.pdf')) {
    return <File className="w-4 h-4 text-red-500 shrink-0" />
  }
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.endsWith('.csv')) {
    return <FileText className="w-4 h-4 text-green-600 shrink-0" />
  }
  if (mimetype?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(lower)) {
    return <FileText className="w-4 h-4 text-purple-500 shrink-0" />
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

// Supabase Storage rejects some Unicode punctuation (smart quotes, dashes,
// backticks) and awkward characters in object keys even URL-encoded. Sanitise
// to plain ASCII-ish, keep the extension, and prefix a timestamp so repeated
// uploads of a same-named scan never collide/overwrite.
function sanitizeFileName(original: string): string {
  const dot = original.lastIndexOf('.')
  const ext = dot > -1 ? original.slice(dot).toLowerCase() : ''
  let base = dot > -1 ? original.slice(0, dot) : original

  base = base
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")   // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '')    // smart double quotes → drop
    .replace(/[\u2010-\u2015\u2212]/g, '-')                    // various dashes → hyphen
    .replace(/[`]/g, '')                                       // backticks
    .replace(/[^\w\s.-]/g, '')                                 // anything not word/space/dot/dash
    .replace(/\s+/g, '_')                                      // spaces → underscore
    .replace(/_+/g, '_')                                       // collapse underscores
    .replace(/^[_.-]+|[_.-]+$/g, '')                           // trim edges
    .slice(0, 80)                                              // keep it reasonable

  if (!base) base = 'document'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `${stamp}_${base}${ext}`
}

export default function PatientDocuments({ patientId }: Props) {
  const supabase = createClient()
  const [files, setFiles] = useState<StorageFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setError(null)
    setFiles((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder') as StorageFile[])
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    window.open(data.signedUrl, '_blank')
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return

    setUploading(true)
    setUploadMsg(null)
    setUploadErr(null)

    let ok = 0
    const failures: string[] = []

    for (const file of selected) {
      if (file.size > MAX_MB * 1024 * 1024) {
        failures.push(`${file.name} (over ${MAX_MB}MB)`)
        continue
      }

      const safeName = sanitizeFileName(file.name)
      const path = `${patientId}/${safeName}`

      const { error: upErr } = await supabase.storage
        .from('patient-documents')
        .upload(path, file, {
          upsert: false,
          contentType: file.type || undefined,
        })

      if (upErr) {
        failures.push(`${file.name} (${upErr.message})`)
      } else {
        ok++
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (ok > 0) setUploadMsg(`${ok} file${ok !== 1 ? 's' : ''} uploaded successfully.`)
    if (failures.length > 0) setUploadErr(`Could not upload: ${failures.join(', ')}`)

    // Refresh the list so new files appear immediately
    await loadFiles()
  }

  const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'))
  const docs = files.filter(f => !f.name.toLowerCase().endsWith('.pdf'))

  return (
    <div className="flex flex-col gap-1">
      {/* Upload control */}
      <div className="flex flex-wrap items-center gap-2 pb-3 mb-1 border-b border-gray-100">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFilesSelected}
          className="hidden"
        />
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs h-8"
        >
          {uploading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload document</>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Images, Word, PDF, Excel · up to {MAX_MB}MB each · multiple allowed
        </span>
      </div>

      {/* Upload feedback */}
      {uploadMsg && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 mb-2">
          <p className="text-xs text-green-700">{uploadMsg}</p>
          <button onClick={() => setUploadMsg(null)} className="text-green-600 hover:text-green-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {uploadErr && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 mb-2">
          <p className="text-xs text-red-600">{uploadErr}</p>
          <button onClick={() => setUploadErr(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading documents…
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-2">Could not load documents: {error}</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No documents on file yet. Use “Upload document” above to add legacy records.
        </p>
      ) : (
        <>
          {[...docs, ...pdfs].map(file => (
            <div
              key={file.id ?? file.name}
              className="flex items-center justify-between py-2.5 border-b
                         border-gray-50 last:border-0 gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileIcon name={file.name} mimetype={file.metadata?.mimetype ?? ''} />
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
            {files.length} file{files.length !== 1 ? 's' : ''} on file.
            {' '}Click Open to view or download.
          </p>
        </>
      )}
    </div>
  )
}
