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
  Loader2,
  Code
} from 'lucide-react'

interface WorkflowItem {
  id: string
  name: string
  description: string
  workspace_id: string
  workspace_name: string
  status: string
  mcp_config: any
  created_at: string
  updated_at: string
}

interface WorkflowSettingsProps {
  workflow: WorkflowItem
  onUpdate: () => void
}

export default function WorkflowSettings({ 
  workflow, 
  onUpdate 
}: WorkflowSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    name: workflow.name,
    description: workflow.description,
    mcp_config: JSON.stringify(workflow.mcp_config, null, 2)
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate MCP config
      validateMcpConfig(formData.mcp_config)

      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          mcp_config: JSON.parse(formData.mcp_config)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update workflow')
      }

      setSuccess('Workflow updated successfully')
      onUpdate()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    const confirmMessage = `Are you sure you want to delete "${workflow.name}"? This will permanently delete all execution history and cannot be undone.`
    
    if (!confirm(confirmMessage)) return

    const doubleConfirm = prompt(`Type "${workflow.name}" to confirm deletion:`)
    if (doubleConfirm !== workflow.name) {
      setError('Deletion cancelled: name does not match')
      return
    }

    setDeleting(true)
    setError('')

    try {
      const response = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete workflow')
      }

      // Redirect to workflows list
      window.location.href = '/workflows'
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setDeleting(false)
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
    <div className="space-y-6">
      {/* Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-500" />
            Workflow Settings
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
                placeholder="Workflow Name"
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
                rows={15}
                disabled={loading}
                className="font-mono text-sm"
              />
              <p className="text-sm text-gray-500">
                Define triggers, actions, and conditions for your workflow in JSON format.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700"
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
          <CardTitle>Workflow Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Workspace:</span>
              <span className="font-medium">{workflow.workspace_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className="font-medium capitalize">{workflow.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <span className="font-medium">
                {new Date(workflow.created_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Updated:</span>
              <span className="font-medium">
                {new Date(workflow.updated_at).toLocaleString()}
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
                Deleting a workflow will permanently remove all execution history and data. This action cannot be undone.
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
              Delete Workflow
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
