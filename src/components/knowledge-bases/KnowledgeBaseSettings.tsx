'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Settings, 
  Save, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from 'lucide-react'

interface KnowledgeBase {
  id: string
  name: string
  description: string
  workspace_id: string
  workspace_name: string
  s3_bucket?: string
  s3_prefix?: string
  file_count: number
  total_size: number
  status: string
  created_at: string
  updated_at: string
}

interface KnowledgeBaseSettingsProps {
  knowledgeBase: KnowledgeBase
  onUpdate: () => void
}

export default function KnowledgeBaseSettings({ 
  knowledgeBase, 
  onUpdate 
}: KnowledgeBaseSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    name: knowledgeBase.name,
    description: knowledgeBase.description,
    s3_prefix: knowledgeBase.s3_prefix || ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBase.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update knowledge base')
      }

      setSuccess('Knowledge base updated successfully')
      onUpdate()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    const confirmMessage = `Are you sure you want to delete "${knowledgeBase.name}"? This will permanently delete all files and cannot be undone.`
    
    if (!confirm(confirmMessage)) return

    const doubleConfirm = prompt(`Type "${knowledgeBase.name}" to confirm deletion:`)
    if (doubleConfirm !== knowledgeBase.name) {
      setError('Deletion cancelled: name does not match')
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/knowledge-bases/${knowledgeBase.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete knowledge base')
      }

      // Redirect to knowledge bases list
      window.location.href = '/knowledge-bases'
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            Knowledge Base Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Knowledge Base Name"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description of your knowledge base..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="s3_prefix">S3 Prefix</Label>
              <Input
                id="s3_prefix"
                type="text"
                value={formData.s3_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, s3_prefix: e.target.value }))}
                placeholder="knowledge-bases/"
                disabled={loading}
              />
              <p className="text-sm text-gray-500">
                S3 folder path for this knowledge base files
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Workspace:</span>
              <span className="font-medium">{knowledgeBase.workspace_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">S3 Bucket:</span>
              <span className="font-medium">{knowledgeBase.s3_bucket || 'Not configured'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <span className="font-medium">
                {new Date(knowledgeBase.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Updated:</span>
              <span className="font-medium">
                {new Date(knowledgeBase.updated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Deleting a knowledge base will permanently remove all files and data. This action cannot be undone.
              </AlertDescription>
            </Alert>
            
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="w-full"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Knowledge Base
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
