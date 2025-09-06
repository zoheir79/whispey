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
    s3_prefix: '',
    pricing_mode: 'fixed', // 'fixed' or 'pag'
    billing_cycle: 'monthly', // 'monthly' or 'yearly'
    kb_per_query_override: undefined as number | undefined,
    kb_per_upload_mb_override: undefined as number | undefined
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
          s3_prefix: knowledgeBase.s3_prefix || '',
          pricing_mode: knowledgeBase.pricing_mode || 'fixed',
          billing_cycle: knowledgeBase.billing_cycle || 'monthly',
          kb_per_query_override: knowledgeBase.kb_per_query_override,
          kb_per_upload_mb_override: knowledgeBase.kb_per_upload_mb_override
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
      setFormData({ 
        name: '', 
        description: '', 
        workspace_id: '', 
        s3_prefix: '', 
        pricing_mode: 'fixed', 
        billing_cycle: 'monthly',
        kb_per_query_override: undefined,
        kb_per_upload_mb_override: undefined
      })
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

          {/* Pricing Mode Selection */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">Pricing Model</Label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  formData.pricing_mode === 'fixed'
                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/50 dark:border-blue-400'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, pricing_mode: 'fixed' }))}
              >
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Fixed Pricing</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Monthly/Annual subscription</div>
                </div>
              </div>
              
              <div
                className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  formData.pricing_mode === 'pag'
                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/50 dark:border-blue-400'  
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, pricing_mode: 'pag' }))}
              >
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Pay-as-You-Go</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Usage-based billing</div>
                </div>
              </div>
            </div>

            {/* Billing Cycle - Only show for fixed pricing */}
            {formData.pricing_mode === 'fixed' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-blue-900 dark:text-blue-100">Billing Cycle</Label>
                <div className="flex gap-2">
                  <div
                    className={`flex-1 p-2 rounded border cursor-pointer transition-all ${
                      formData.billing_cycle === 'monthly'
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/50'
                        : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, billing_cycle: 'monthly' }))}
                  >
                    <div className="text-center text-xs font-medium text-gray-900 dark:text-gray-100">Monthly</div>
                  </div>
                  
                  <div
                    className={`flex-1 p-2 rounded border cursor-pointer transition-all ${
                      formData.billing_cycle === 'yearly'
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/50'
                        : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, billing_cycle: 'yearly' }))}
                  >
                    <div className="text-center text-xs font-medium text-gray-900 dark:text-gray-100">Yearly</div>
                  </div>
                </div>
              </div>
            )}

            {/* PAG Overrides - Only show for PAG pricing */}
            {formData.pricing_mode === 'pag' && (
              <div className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                <Label className="text-sm font-medium text-yellow-900 dark:text-yellow-100">PAG Pricing Overrides (Optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="kb_per_query_override" className="text-xs text-yellow-800 dark:text-yellow-200">Per Query ($)</Label>
                    <Input
                      id="kb_per_query_override"
                      type="number"
                      step="0.0001"
                      value={formData.kb_per_query_override || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, kb_per_query_override: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="Default global rate"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kb_per_upload_mb_override" className="text-xs text-yellow-800 dark:text-yellow-200">Per Upload MB ($)</Label>
                    <Input
                      id="kb_per_upload_mb_override"
                      type="number"
                      step="0.001"
                      value={formData.kb_per_upload_mb_override || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, kb_per_upload_mb_override: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="Default global rate"
                      className="text-xs h-8"
                    />
                  </div>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  Leave empty to use global PAG rates. Override only if specific pricing needed.
                </p>
              </div>
            )}

            {/* Cost Estimation */}
            <div className="p-2 bg-white dark:bg-slate-800 rounded border">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Cost:</div>
              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {formData.pricing_mode === 'fixed' 
                  ? formData.billing_cycle === 'yearly' 
                    ? '$499.90/year' 
                    : '$49.99/month'
                  : 'Variable based on usage'
                }
              </div>
            </div>
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
