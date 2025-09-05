"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Copy, Eye, EyeOff, CheckCircle, Cloud, Database } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ProjectCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (project: any) => void
}

const ProjectCreationDialog: React.FC<ProjectCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onProjectCreated 
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    s3_enabled: false,
    s3_region: 'us-east-1',
    s3_endpoint: '',
    s3_bucket_prefix: '',
    s3_access_key: '',
    s3_secret_key: '',
    s3_cost_per_gb: 0.023,
    s3_default_storage_gb: 50
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdProjectData, setCreatedProjectData] = useState<any>(null)
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Project name is required')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          s3_enabled: formData.s3_enabled,
          s3_region: formData.s3_enabled ? formData.s3_region : null,
          s3_endpoint: formData.s3_enabled && formData.s3_endpoint ? formData.s3_endpoint : null,
          s3_bucket_prefix: formData.s3_enabled && formData.s3_bucket_prefix ? formData.s3_bucket_prefix : null,
          s3_access_key: formData.s3_enabled && formData.s3_access_key ? formData.s3_access_key : null,
          s3_secret_key: formData.s3_enabled && formData.s3_secret_key ? formData.s3_secret_key : null,
          s3_cost_per_gb: formData.s3_enabled ? formData.s3_cost_per_gb : null,
          s3_default_storage_gb: formData.s3_enabled ? formData.s3_default_storage_gb : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()
      setCreatedProjectData(data)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('Error creating project:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyToken = async () => {
    if (createdProjectData?.api_token) {
      try {
        await navigator.clipboard.writeText(createdProjectData.api_token)
        setTokenCopied(true)
        setTimeout(() => setTokenCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy token:', err)
      }
    }
  }

  const handleClose = () => {
    if (!loading) {
      // Reset all state
      setCurrentStep('form')
      setFormData({
        name: '',
        description: '',
        s3_enabled: false,
        s3_region: 'us-east-1',
        s3_endpoint: '',
        s3_bucket_prefix: '',
        s3_access_key: '',
        s3_secret_key: '',
        s3_cost_per_gb: 0.023,
        s3_default_storage_gb: 50
      })
      setError(null)
      setCreatedProjectData(null)
      setShowToken(false)
      setTokenCopied(false)
      onClose()
    }
  }

  const handleFinish = () => {
    // Call success callback with the created project
    onProjectCreated(createdProjectData)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 rounded-xl border shadow-2xl bg-white dark:bg-slate-800 dark:border-slate-700">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Create New Project
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Set up your voice AI project with automatic API token generation
              </p>
            </DialogHeader>

            {/* Form */}
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Project Name */}
                <div>
                  <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Project Name
                  </label>
                  <Input
                    id="project-name"
                    placeholder="Enter project name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-11 px-4 text-sm border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    placeholder="Brief description of your project..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={loading}
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:outline-none resize-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* S3 Storage Configuration */}
                <div className="space-y-4 p-4 border border-gray-200 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-blue-500" />
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable S3 Storage
                      </label>
                    </div>
                    <Switch
                      checked={formData.s3_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, s3_enabled: checked })}
                      disabled={loading}
                    />
                  </div>
                  
                  {formData.s3_enabled && (
                    <div className="space-y-3 pl-6">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Region
                          </label>
                          <Select
                            value={formData.s3_region}
                            onValueChange={(value) => setFormData({ ...formData, s3_region: value })}
                            disabled={loading}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                              <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                              <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                              <SelectItem value="ap-south-1">Asia Pacific (Mumbai)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Endpoint <span className="text-gray-500">(optional)</span>
                          </label>
                          <Input
                            placeholder="s3.amazonaws.com"
                            value={formData.s3_endpoint}
                            onChange={(e) => setFormData({ ...formData, s3_endpoint: e.target.value })}
                            disabled={loading}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Bucket Prefix
                          </label>
                          <Input
                            placeholder="myproject-voice"
                            value={formData.s3_bucket_prefix}
                            onChange={(e) => setFormData({ ...formData, s3_bucket_prefix: e.target.value })}
                            disabled={loading}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Default Storage (GB)
                          </label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={formData.s3_default_storage_gb}
                            onChange={(e) => setFormData({ ...formData, s3_default_storage_gb: parseInt(e.target.value) || 50 })}
                            disabled={loading}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Access Key
                          </label>
                          <Input
                            type="password"
                            placeholder="AKIAIOSFODNN7EXAMPLE"
                            value={formData.s3_access_key}
                            onChange={(e) => setFormData({ ...formData, s3_access_key: e.target.value })}
                            disabled={loading}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Secret Key
                          </label>
                          <Input
                            type="password"
                            placeholder="wJalrXUtnFEMI/K7MDENG..."
                            value={formData.s3_secret_key}
                            onChange={(e) => setFormData({ ...formData, s3_secret_key: e.target.value })}
                            disabled={loading}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Cost per GB/month ($)
                        </label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={formData.s3_cost_per_gb}
                          onChange={(e) => setFormData({ ...formData, s3_cost_per_gb: parseFloat(e.target.value) || 0.023 })}
                          disabled={loading}
                          className="h-9 text-xs w-32"
                        />
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Estimated Monthly S3 Cost:</p>
                        <p>${(formData.s3_cost_per_gb * formData.s3_default_storage_gb).toFixed(2)} for {formData.s3_default_storage_gb}GB storage</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-sm text-red-700 font-medium">{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 h-11 font-medium text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="flex-1 h-11 text-white rounded-lg font-medium shadow-sm disabled:bg-gray-300 disabled:text-gray-500 transition-all"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Create Project'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Project Created Successfully!
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Your project "{createdProjectData?.name}" has been created with API access
              </p>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 pb-6 space-y-4">
              {/* API Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={createdProjectData?.api_token || ''}
                    readOnly
                    className="w-full h-11 px-4 pr-20 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-gray-100 font-mono"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowToken(!showToken)}
                      className="h-7 w-7 p-0"
                    >
                      {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyToken}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {tokenCopied && (
                  <p className="text-xs text-green-600 mt-1">Token copied to clipboard!</p>
                )}
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Important:</strong> This token will only be shown once. Please save it in a secure location.
                  You can regenerate it later if needed.
                </p>
              </div>

              {/* Project Details */}
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-2">Project Details</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">ID:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{createdProjectData?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Environment:</span>
                    <span className="text-gray-800 dark:text-gray-200">{createdProjectData?.environment}</span>
                  </div>
                </div>
              </div>

              {/* Finish Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleFinish}
                  className="w-full h-11 text-white rounded-lg font-medium shadow-sm"
                >
                  Continue to Project
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ProjectCreationDialog 