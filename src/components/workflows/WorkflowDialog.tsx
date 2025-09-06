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
    }, null, 2)
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
          mcp_config: JSON.stringify(workflow.mcp_config || {
            triggers: [],
            actions: [],
            conditions: []
          }, null, 2)
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
        }, null, 2)
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
