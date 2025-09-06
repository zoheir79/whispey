'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Workflow } from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface Workspace {
  id: string
  name: string
}

interface WorkflowDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  workflow?: any
}

export default function WorkflowDialog({ 
  open, 
  onClose, 
  onSuccess, 
  workflow 
}: WorkflowDialogProps) {
  const [loading, setLoading] = useState(false)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workspace_id: '',
    mcp_config: JSON.stringify({
      triggers: [],
      actions: [],
      conditions: []
    }, null, 2),
    pricing_mode: 'fixed', // 'fixed' or 'pag'
    billing_cycle: 'monthly', // 'monthly' or 'yearly'
    workflow_per_execution_override: undefined as number | undefined,
    workflow_per_cpu_minute_override: undefined as number | undefined
  })
  const [error, setError] = useState('')
  const { isAdmin } = useGlobalRole()

  useEffect(() => {
    if (open) {
      fetchWorkspaces()
      if (workflow) {
        setFormData({
          name: workflow.name || '',
          description: workflow.description || '',
          workspace_id: workflow.workspace_id || '',
          mcp_config: workflow.mcp_config || JSON.stringify({
            triggers: [],
            actions: [],
            conditions: []
          }, null, 2),
          pricing_mode: workflow.pricing_mode || 'fixed',
          billing_cycle: workflow.billing_cycle || 'monthly',
          workflow_per_execution_override: workflow.workflow_per_execution_override,
          workflow_per_cpu_minute_override: workflow.workflow_per_cpu_minute_override
        })
      }
    }
  }, [open, workflow])

  const fetchWorkspaces = async () => {
    try {
      // Use scope=all for super admins to get all workspaces
      const endpoint = isAdmin ? '/api/projects?scope=all' : '/api/projects'
      const response = await fetch(endpoint)
      if (response.ok) {
        const data = await response.json()
        const availableWorkspaces = data || []
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

  const validateMcpConfig = (configString: string) => {
    try {
      const config = JSON.parse(configString)
      if (!config.triggers || !Array.isArray(config.triggers)) {
        throw new Error('MCP config must have a triggers array')
      }
      if (!config.actions || !Array.isArray(config.actions)) {
        throw new Error('MCP config must have an actions array')
      }
      return true
    } catch (error) {
      throw new Error(`Invalid MCP configuration: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Validate MCP config
      validateMcpConfig(formData.mcp_config)

      const method = workflow ? 'PUT' : 'POST'
      const url = workflow 
        ? `/api/workflows/${workflow.id}` 
        : '/api/workflows'

      const payload = {
        ...formData,
        mcp_config: JSON.parse(formData.mcp_config)
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${workflow ? 'update' : 'create'} workflow`)
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
        mcp_config: JSON.stringify({
          triggers: [],
          actions: [],
          conditions: []
        }, null, 2),
        pricing_mode: 'fixed',
        billing_cycle: 'monthly',
        workflow_per_execution_override: undefined,
        workflow_per_cpu_minute_override: undefined
      })
      setError('')
      onClose()
    }
  }

  const insertMcpTemplate = (template: string) => {
    const templates = {
      basic: {
        triggers: [
          {
            type: "schedule",
            schedule: "0 9 * * *",
            description: "Run daily at 9 AM"
          }
        ],
        actions: [
          {
            type: "http_request",
            url: "https://api.example.com/data",
            method: "GET",
            description: "Fetch data from API"
          }
        ],
        conditions: [
          {
            type: "response_check",
            field: "status",
            operator: "equals",
            value: "success"
          }
        ]
      },
      webhook: {
        triggers: [
          {
            type: "webhook",
            endpoint: "/webhook/my-workflow",
            description: "Trigger via webhook"
          }
        ],
        actions: [
          {
            type: "process_data",
            transformation: "json_parse",
            description: "Process incoming data"
          }
        ],
        conditions: []
      }
    }

    const selectedTemplate = templates[template as keyof typeof templates]
    if (selectedTemplate) {
      setFormData(prev => ({
        ...prev,
        mcp_config: JSON.stringify(selectedTemplate, null, 2)
      }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-teal-500" />
            {workflow ? 'Edit Workflow' : 'Create New Workflow'}
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
            <Label htmlFor="name">Workflow Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="My Workflow"
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
              placeholder="Description of your workflow..."
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace">Workspace</Label>
            <Select
              value={formData.workspace_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, workspace_id: value }))}
              disabled={loading || !!workflow}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mcp_config">MCP Configuration</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => insertMcpTemplate('basic')}
                  disabled={loading}
                >
                  Basic Template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => insertMcpTemplate('webhook')}
                  disabled={loading}
                >
                  Webhook Template
                </Button>
              </div>
            </div>
            <Textarea
              id="mcp_config"
              value={formData.mcp_config}
              onChange={(e) => setFormData(prev => ({ ...prev, mcp_config: e.target.value }))}
              placeholder="MCP configuration as JSON..."
              rows={12}
              disabled={loading}
              className="font-mono text-sm"
            />
            <p className="text-sm text-gray-500">
              Define triggers, actions, and conditions for your workflow in JSON format.
            </p>
          </div>

          {/* Pricing Mode Selection */}
          <div className="space-y-3 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-700">
            <Label className="text-sm font-medium text-teal-900 dark:text-teal-100">Pricing Model</Label>
            <div className="flex gap-2">
              <div
                className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  formData.pricing_mode === 'fixed'
                    ? 'border-teal-500 bg-teal-100 dark:bg-teal-800/50 dark:border-teal-400'
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
                    ? 'border-teal-500 bg-teal-100 dark:bg-teal-800/50 dark:border-teal-400'  
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
                <Label className="text-sm font-medium text-teal-900 dark:text-teal-100">Billing Cycle</Label>
                <div className="flex gap-2">
                  <div
                    className={`flex-1 p-2 rounded border cursor-pointer transition-all ${
                      formData.billing_cycle === 'monthly'
                        ? 'border-teal-500 bg-teal-100 dark:bg-teal-800/50'
                        : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setFormData(prev => ({ ...prev, billing_cycle: 'monthly' }))}
                  >
                    <div className="text-center text-xs font-medium text-gray-900 dark:text-gray-100">Monthly</div>
                  </div>
                  
                  <div
                    className={`flex-1 p-2 rounded border cursor-pointer transition-all ${
                      formData.billing_cycle === 'yearly'
                        ? 'border-teal-500 bg-teal-100 dark:bg-teal-800/50'
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
                    <Label htmlFor="workflow_per_execution_override" className="text-xs text-yellow-800 dark:text-yellow-200">Per Execution ($)</Label>
                    <Input
                      id="workflow_per_execution_override"
                      type="number"
                      step="0.001"
                      value={formData.workflow_per_execution_override || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, workflow_per_execution_override: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="Default global rate"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="workflow_per_cpu_minute_override" className="text-xs text-yellow-800 dark:text-yellow-200">Per CPU Minute ($)</Label>
                    <Input
                      id="workflow_per_cpu_minute_override"
                      type="number"
                      step="0.001"
                      value={formData.workflow_per_cpu_minute_override || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, workflow_per_cpu_minute_override: e.target.value ? parseFloat(e.target.value) : undefined }))}
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
              <div className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                {formData.pricing_mode === 'fixed' 
                  ? formData.billing_cycle === 'yearly' 
                    ? '$299.90/year' 
                    : '$29.99/month'
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
              disabled={loading || !formData.workspace_id}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {workflow ? 'Update' : 'Create'} Workflow
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
