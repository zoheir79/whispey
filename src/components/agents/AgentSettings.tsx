'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Check, Loader2, Save, Settings, ToggleLeft, ToggleRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Agent {
  id: string
  name: string
  agent_type: string
  environment: string
  project_id: string
  configuration: any
  is_active: boolean
  created_at: string
  updated_at?: string
  vapi_api_key_encrypted?: string
  vapi_project_key_encrypted?: string
  field_extractor?: boolean
  field_extractor_prompt?: string
}

interface AgentSettingsProps {
  agent: Agent
  onAgentUpdate: (updatedAgent: Agent) => void
}

export default function AgentSettings({ agent, onAgentUpdate }: AgentSettingsProps) {
  const [formData, setFormData] = useState({
    name: agent.name || '',
    agent_type: agent.agent_type || 'inbound',
    environment: agent.environment || 'dev',
    is_active: agent.is_active ?? true,
    field_extractor: agent.field_extractor ?? false,
    field_extractor_prompt: agent.field_extractor_prompt || '',
    configuration: JSON.stringify(agent.configuration || {}, null, 2)
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Track changes
  useEffect(() => {
    const hasChanged = 
      formData.name !== agent.name ||
      formData.agent_type !== agent.agent_type ||
      formData.environment !== agent.environment ||
      formData.is_active !== agent.is_active ||
      formData.field_extractor !== (agent.field_extractor ?? false) ||
      formData.field_extractor_prompt !== (agent.field_extractor_prompt || '') ||
      formData.configuration !== JSON.stringify(agent.configuration || {}, null, 2)
    
    setHasChanges(hasChanged)
  }, [formData, agent])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!hasChanges) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate JSON configuration
      let parsedConfig = {}
      try {
        parsedConfig = JSON.parse(formData.configuration)
      } catch (e) {
        throw new Error('Invalid JSON in configuration field')
      }

      const updateData = {
        name: formData.name.trim(),
        agent_type: formData.agent_type,
        environment: formData.environment,
        is_active: formData.is_active,
        field_extractor: formData.field_extractor,
        field_extractor_prompt: formData.field_extractor_prompt,
        configuration: parsedConfig
      }

      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update agent')
      }

      const updatedAgent = await response.json()
      onAgentUpdate(updatedAgent)
      setSuccess('Agent settings updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)

    } catch (error) {
      console.error('Error updating agent:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-50 text-red-700 border-red-200'
      case 'staging':
      case 'stage':
        return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const getAgentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'outbound':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'custom':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-600" />
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Agent Settings</h1>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card className="dark:bg-blue-900 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg dark:text-gray-100">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter agent name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="agent_type">Agent Type</Label>
              <Select value={formData.agent_type} onValueChange={(value) => handleInputChange('agent_type', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select agent type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="environment">Environment</Label>
              <Select value={formData.environment} onValueChange={(value) => handleInputChange('environment', value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange('is_active', checked)}
              />
              <Label htmlFor="is_active" className="flex items-center gap-2">
                Agent Status
                <Badge 
                  className={`px-2 py-1 text-xs ${formData.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                >
                  {formData.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Badges */}
      <Card className="dark:bg-blue-900 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg dark:text-gray-100">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge className={`px-3 py-1 ${getAgentTypeColor(formData.agent_type)}`}>
              {formData.agent_type.toUpperCase()}
            </Badge>
            <Badge className={`px-3 py-1 ${getEnvironmentColor(formData.environment)}`}>
              {formData.environment.toUpperCase()}
            </Badge>
            <Badge className={`px-3 py-1 ${formData.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {formData.is_active ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card className="dark:bg-blue-900 dark:border-blue-700">
        <CardHeader>
          <CardTitle className="text-lg dark:text-gray-100">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="field_extractor">Field Extractor</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enable field extraction from call transcripts</p>
            </div>
            <Switch
              id="field_extractor"
              checked={formData.field_extractor}
              onCheckedChange={(checked) => handleInputChange('field_extractor', checked)}
            />
          </div>

          {formData.field_extractor && (
            <div>
              <Label htmlFor="field_extractor_prompt">Field Extractor Prompt</Label>
              <Textarea
                id="field_extractor_prompt"
                value={formData.field_extractor_prompt}
                onChange={(e) => handleInputChange('field_extractor_prompt', e.target.value)}
                placeholder="Enter field extraction prompt..."
                rows={3}
                className="mt-1"
              />
            </div>
          )}

          <Separator />

          <div>
            <Label htmlFor="configuration">Agent Configuration (JSON)</Label>
            <Textarea
              id="configuration"
              value={formData.configuration}
              onChange={(e) => handleInputChange('configuration', e.target.value)}
              placeholder="Enter JSON configuration..."
              rows={8}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Advanced configuration in JSON format. Please ensure valid JSON syntax.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isLoading ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
        </Button>
      </div>
    </div>
  )
}
