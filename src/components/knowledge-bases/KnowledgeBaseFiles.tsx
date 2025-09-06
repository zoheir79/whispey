'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  FileText, 
  Trash2, 
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'

interface KnowledgeBaseFile {
  id: string
  filename: string
  original_filename: string
  file_size: number
  content_type: string
  status: 'uploading' | 'processing' | 'completed' | 'error'
  upload_cost?: number
  embedding_tokens?: number
  created_at: string
  updated_at: string
}

interface KnowledgeBaseFilesProps {
  knowledgeBaseId: string
  onFileChange: () => void
}

export default function KnowledgeBaseFiles({ 
  knowledgeBaseId, 
  onFileChange 
}: KnowledgeBaseFilesProps) {
  const [files, setFiles] = useState<KnowledgeBaseFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchFiles()
  }, [knowledgeBaseId])

  const fetchFiles = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/files`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // Estimate cost first
    try {
      const formData = new FormData()
      acceptedFiles.forEach(file => {
        formData.append('files', file)
      })

      const estimateResponse = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/estimate-cost`, {
        method: 'POST',
        body: formData
      })

      if (estimateResponse.ok) {
        const estimateData = await estimateResponse.json()
        setEstimatedCost(estimateData.estimated_cost)
        
        // Proceed with upload
        await uploadFiles(acceptedFiles)
      }
    } catch (error) {
      console.error('Failed to estimate cost:', error)
      // Proceed with upload anyway
      await uploadFiles(acceptedFiles)
    }
  }, [knowledgeBaseId])

  const uploadFiles = async (filesToUpload: File[]) => {
    try {
      setUploading(true)
      setError('')
      setUploadProgress(0)

      const formData = new FormData()
      filesToUpload.forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/files`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      // Refresh files list
      await fetchFiles()
      onFileChange()
      
      setEstimatedCost(null)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return

    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBaseId}/files/${fileId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      await fetchFiles()
      onFileChange()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    disabled: uploading
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('text/')) return <FileText className="w-5 h-5 text-blue-500" />
    if (contentType === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />
    return <FileText className="w-5 h-5 text-gray-500" />
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'uploading':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredFiles = files.filter(file => 
    file.original_filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.content_type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-orange-500" />
            Upload Files
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {estimatedCost !== null && (
            <Alert className="mb-4">
              <DollarSign className="w-4 h-4" />
              <AlertDescription>
                Estimated upload cost: <strong>${estimatedCost.toFixed(4)}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragActive 
                ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
              ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Drop the files here...
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Supported: .txt, .md, .pdf, .docx, .csv, .json
                </p>
              </>
            )}
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Files ({files.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No files found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No files match your search.' : 'Upload files to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.content_type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {file.original_filename}
                        </h4>
                        {getStatusIcon(file.status)}
                        <Badge className={`text-xs ${getStatusColor(file.status)}`}>
                          {file.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span>{file.content_type}</span>
                        {file.upload_cost && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            ${file.upload_cost.toFixed(4)}
                          </span>
                        )}
                        {file.embedding_tokens && (
                          <span>{file.embedding_tokens} tokens</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/api/knowledge-bases/${knowledgeBaseId}/files/${file.id}/download`, '_blank')}
                      disabled={file.status !== 'completed'}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteFile(file.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
