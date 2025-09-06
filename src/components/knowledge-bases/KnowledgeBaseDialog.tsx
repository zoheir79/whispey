'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Database } from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface Workspace {
  id: string
  name: string
  s3_enabled: boolean
}

interface KnowledgeBaseDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  knowledgeBase?: any
}

export default function KnowledgeBaseDialog({ 
  open, 
  onClose, 
  onSuccess, 
  knowledgeBase 
}: KnowledgeBaseDialogProps) {
  const [loading, setLoading] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workspace_id: '',
    s3_prefix: ''
  })
  const [error, setError] = useState('')
  const { isAdmin } = useGlobalRole()

  useEffect(() => {
    if (open) {
      fetchWorkspaces()
      if (knowledgeBase) {
        setFormData({
          name: knowledgeBase.name || '',
          description: knowledgeBase.description || '',
          workspace_id: knowledgeBase.workspace_id || '',
          s3_prefix: knowledgeBase.s3_prefix || ''
        })
      }
    }
  }, [open, knowledgeBase])

  const fetchWorkspaces = async () => {
    try {
      // Use scope=all for super admins to get all workspaces
      const endpoint = isAdmin ? '/api/projects?scope=all' : '/api/projects'
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        // For super admins, show all workspaces. For regular users, filter S3 enabled only
        const availableWorkspaces = isAdmin 
          ? (data || []) 
          : (data?.filter((p: any) => p.s3_enabled) || [])
        setWorkspaces(availableWorkspaces)
        
        // Auto-select first workspace if only one available
        if (availableWorkspaces.length === 1 && !formData.workspace_id) {
          setFormData(prev => ({ ...prev, workspace_id: availableWorkspaces[0].id }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch workspaces:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const method = knowledgeBase ? 'PUT' : 'POST'
      const url = knowledgeBase 
        ? `/api/knowledge-bases/${knowledgeBase.id}` 
        : '/api/knowledge-bases'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409 || data.error?.includes('duplicate key')) {
          throw new Error(`A knowledge base with the name "${formData.name}" already exists in this workspace. Please choose a different name.`)
        }
        throw new Error(data.error || `Failed to ${knowledgeBase ? 'update' : 'create'} knowledge base`)
      }

      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', description: '', workspace_id: '', s3_prefix: '' })
      setError('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-500" />
            {knowledgeBase ? 'Edit Knowledge Base' : 'Create New Knowledge Base'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Knowledge Base Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Knowledge Base"
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
            <Label htmlFor="workspace">Workspace</Label>
            <Select
              value={formData.workspace_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, workspace_id: value }))}
              disabled={loading || !!knowledgeBase}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workspace with S3 enabled" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    <div className="flex items-center gap-2">
                      <span>{workspace.name}</span>
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                        S3 Enabled
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workspaces.length === 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                No workspaces with S3 configuration found. Please configure S3 for a workspace first.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="s3_prefix">S3 Prefix (Optional)</Label>
            <Input
              id="s3_prefix"
              type="text"
              value={formData.s3_prefix}
              onChange={(e) => setFormData(prev => ({ ...prev, s3_prefix: e.target.value }))}
              placeholder="knowledge-bases/"
              disabled={loading}
            />
            <p className="text-sm text-gray-500">
              S3 folder path for this knowledge base. If empty, will use default structure.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || workspaces.length === 0 || !formData.workspace_id}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {knowledgeBase ? 'Update' : 'Create'} Knowledge Base
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
