'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, Trash2, FileText, Image, File } from 'lucide-react'
import { toast } from 'sonner'

type StorageFile = {
  name: string
  id: string
  created_at: string
  metadata?: { size?: number; mimetype?: string }
}

type Props = {
  visitId: string
  patientId: string
}

// Pick an icon based on file type
function FileIcon({ mimetype }: { mimetype?: string }) {
  if (!mimetype) return <File className="w-4 h-4 text-gray-400" />
  if (mimetype.startsWith('image/')) return <Image className="w-4 h-4 text-blue-400" />
  if (mimetype === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />
  return <File className="w-4 h-4 text-gray-400" />
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function VisitDocuments({ visitId, patientId }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<StorageFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Files are stored at: visit-documents/{patientId}/{visitId}/{filename}
  // This path structure keeps each visit's files organised
  const storagePath = `${patientId}/${visitId}`

  async function fetchFiles() {
    setLoading(true)
    const { data, error } = await supabase.storage
      .from('visit-documents')
      .list(storagePath, { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) {
      toast.error('Could not load documents.')
      console.error(error)
    } else {
      // Filter out the empty placeholder Supabase sometimes adds
      setFiles((data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder'))
    }
    setLoading(false)
  }

  useEffect(() => { fetchFiles() }, [visitId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB.')
      return
    }

    setUploading(true)

    // Use timestamp prefix to avoid name collisions
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const fullPath = `${storagePath}/${safeName}`

    const { error } = await supabase.storage
      .from('visit-documents')
      .upload(fullPath, file)

    setUploading(false)

    if (error) {
      toast.error('Upload failed. Please try again.')
      console.error(error)
    } else {
      toast.success(`${file.name} uploaded.`)
      fetchFiles() // refresh the list
    }

    // Reset the input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDownload(fileName: string) {
    // Generate a signed URL valid for 60 seconds
    const { data, error } = await supabase.storage
      .from('visit-documents')
      .createSignedUrl(`${storagePath}/${fileName}`, 60)

    if (error || !data?.signedUrl) {
      toast.error('Could not open file.')
      return
    }

    // Open in new tab
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return

    setDeletingId(fileName)

    const { error } = await supabase.storage
      .from('visit-documents')
      .remove([`${storagePath}/${fileName}`])

    setDeletingId(null)

    if (error) {
      toast.error('Could not delete file.')
      console.error(error)
    } else {
      toast.success('File deleted.')
      fetchFiles()
    }
  }

  // Strip the timestamp prefix for display
  function displayName(fileName: string) {
    return fileName.replace(/^\d+_/, '')
  }

  return (
    <div>
      {/* Upload button */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {loading ? 'Loading...' : `${files.length} document${files.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading...' : 'Upload file'}
        </button>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleUpload}
        />
      </div>

      {/* File list */}
      {loading ? (
        <div className="py-4 text-center">
          <p className="text-xs text-muted-foreground">Loading documents...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-gray-200 rounded-lg">
          <Paperclip className="w-5 h-5 text-gray-300 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          <p className="text-xs text-muted-foreground">Upload scans, referral letters, or PDFs.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {files.map(file => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-gray-50/50 px-3 py-2 group"
            >
              {/* File icon + name */}
              <button
                onClick={() => handleDownload(file.name)}
                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-70 transition-opacity"
              >
                <FileIcon mimetype={file.metadata?.mimetype} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {displayName(file.name)}
                  </p>
                  {file.metadata?.size && (
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(file.metadata.size)}
                    </p>
                  )}
                </div>
              </button>

              {/* Delete button — shows on hover */}
              <button
                onClick={() => handleDelete(file.name)}
                disabled={deletingId === file.name}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                title="Delete file"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}