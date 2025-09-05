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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle, Check, Loader2, Save, Settings, X, Database, Cloud } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import WorkspaceNameInput from '@/components/ui/WorkspaceNameInput'

interface Project {
  id: string
  name: string
  description: string
  environment: string
  created_at: string
  is_active: boolean
  token_hash?: string
  agent_count?: number
  s3_enabled?: boolean
  s3_region?: string
  s3_endpoint?: string
  s3_bucket_prefix?: string
  s3_cost_per_gb?: number
  s3_default_storage_gb?: number
}

interface WorkspaceSettingsProps {
  isOpen: boolean
  onClose: () => void
  project: Project | null
  onProjectUpdate: (updatedProject: Project) => void
}

export default function WorkspaceSettings({ isOpen, onClose, project, onProjectUpdate }: WorkspaceSettingsProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    environment: 'dev',
    is_active: true
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Initialize form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        environment: project.environment || 'dev',
        is_active: project.is_active ?? true
      })
    }
  }, [project])

  // Track changes
  useEffect(() => {
    if (!project) return
    
    const hasChanged = 
      formData.name !== project.name ||
      formData.description !== (project.description || '') ||
      formData.environment !== project.environment ||
      formData.is_active !== project.is_active
    
    setHasChanges(hasChanged)
  }, [formData, project])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!hasChanges || !project) return

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        environment: formData.environment,
        is_active: formData.is_active
      }

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update workspace')
      }

      const updatedProject = await response.json()
      onProjectUpdate(updatedProject)
      setSuccess('Workspace settings updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)

    } catch (error) {
      console.error('Error updating workspace:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setError(null)
    setSuccess(null)
    onClose()
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

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-gray-600 dark:text-slate-400" />
              <DialogTitle className="text-lg font-semibold dark:text-slate-100">Workspace Settings</DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
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
          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-200">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="dark:text-slate-300">Workspace Name</Label>
                  <WorkspaceNameInput
                    value={formData.name}
                    onChange={(value) => handleInputChange('name', value)}
                    placeholder="Enter workspace name"
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="dark:text-slate-300">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter workspace description"
                    rows={3}
                    className="mt-1 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 dark:placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <Label htmlFor="environment" className="dark:text-slate-300">Environment</Label>
                  <Select value={formData.environment} onValueChange={(value) => handleInputChange('environment', value)}>
                    <SelectTrigger className="mt-1 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
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
                  <Label htmlFor="is_active" className="flex items-center gap-2 dark:text-slate-300">
                    Workspace Status
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

          {/* S3 Configuration */}
          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-200 flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                S3 Storage Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project?.s3_enabled ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium dark:text-slate-300">Storage Status</span>
                    <Badge className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                      <Cloud className="h-3 w-3 mr-1" />
                      S3 Enabled
                    </Badge>
                  </div>
                  
                  <Separator className="dark:bg-slate-700" />
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Region:</span>
                      <p className="font-medium dark:text-slate-200">{project.s3_region || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Endpoint:</span>
                      <p className="font-medium dark:text-slate-200 truncate">{project.s3_endpoint || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Bucket Prefix:</span>
                      <p className="font-medium dark:text-slate-200">{project.s3_bucket_prefix || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Cost per GB/month:</span>
                      <p className="font-medium dark:text-slate-200">${project.s3_cost_per_gb?.toFixed(4) || '0.0230'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Default Storage:</span>
                      <p className="font-medium dark:text-slate-200">{project.s3_default_storage_gb || 50} GB</p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-slate-400">Bucket Pattern:</span>
                      <p className="font-medium font-mono text-xs dark:text-slate-200 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                        {project.s3_bucket_prefix}-[agent-id]
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-sm font-medium mb-1">
                      <Cloud className="h-4 w-4" />
                      S3 Bucket Management
                    </div>
                    <p className="text-blue-700 dark:text-blue-300 text-xs">
                      Each voice agent created in this workspace will automatically get a dedicated S3 bucket: 
                      <code className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded text-xs">
                        {project.s3_bucket_prefix}-[agent-id]
                      </code>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="flex flex-col items-center gap-3">
                    <Database className="h-12 w-12 text-gray-400 dark:text-slate-600" />
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-slate-200">No S3 Configuration</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        This workspace doesn't have S3 storage configured.
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 mt-2">
                        Voice agents will use default storage settings with $0 cost.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="dark:bg-slate-800 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-base dark:text-slate-200">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge className={`px-3 py-1 ${getEnvironmentColor(formData.environment)}`}>
                  {formData.environment.toUpperCase()}
                </Badge>
                <Badge className={`px-3 py-1 ${formData.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {formData.is_active ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
                {project?.s3_enabled && (
                  <Badge className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                    S3 ENABLED
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-700">
            <Button variant="outline" onClick={handleClose} className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
              Cancel
            </Button>
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
      </DialogContent>
    </Dialog>
  )
}
