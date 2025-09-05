'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, Check, Loader2, Save, Settings, Phone, Bot, Brain, Server, Zap, Database, Cloud, DollarSign } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProviders, getProvidersByType } from '@/hooks/useProviders'
import { useCostOverrides } from '@/hooks/useCostOverrides'
import { useGlobalRole } from '@/hooks/useGlobalRole'

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
  platform_mode?: string
  billing_cycle?: string
  provider_config?: any
  pricing_config?: any
  s3_storage_gb?: number
  description?: string
}

interface AgentSettingsProps {
  agent: Agent
  onAgentUpdate: (updatedAgent: Agent) => void
  projectData?: {
    s3_enabled?: boolean
    s3_region?: string
    s3_endpoint?: string
    s3_bucket_prefix?: string
    s3_cost_per_gb?: number
    s3_default_storage_gb?: number
  }
}

const PLATFORM_MODES = [
  { 
    value: 'dedicated', 
    label: 'Dedicated',
    description: 'Fixed monthly cost, unlimited usage',
    icon: Server,
    color: 'purple'
  },
  { 
    value: 'pag', 
    label: 'Pay-as-you-Go',
    description: 'Pay only for what you use',
    icon: Zap,
    color: 'green'
  },
  { 
    value: 'hybrid', 
    label: 'Hybrid',
    description: 'Mix dedicated and PAG models',
    icon: Settings,
    color: 'blue'
  }
]

const AGENT_TYPES = [
  { 
    value: 'voice', 
    label: 'Voice Agent',
    description: 'Handle voice calls',
    icon: Phone,
  },
  { 
    value: 'text_only', 
    label: 'Text-only Agent',
    description: 'Process text interactions',
    icon: Brain,
  }
]

const VOICE_TYPES = [
  { value: 'inbound', label: 'Inbound', description: 'Handle incoming calls' },
  { value: 'outbound', label: 'Outbound', description: 'Make automated calls' },
  { value: 'custom', label: 'Custom', description: 'Specialized agent' }
]

export default function AgentSettings({ agent, onAgentUpdate, projectData }: AgentSettingsProps) {
  const { providers, globalSettings, loading: providersLoading } = useProviders()
  const { agent: costAgent, updateOverrides, resetOverrides } = useCostOverrides(null)
  const { globalRole, isSuperAdmin } = useGlobalRole()
  const [showCostOverrides, setShowCostOverrides] = useState(false)
  const [tempCostOverrides, setTempCostOverrides] = useState<any>({})
  const [selectedPlatform, setSelectedPlatform] = useState(agent.platform_mode || 'pag')
  
  const [formData, setFormData] = useState({
    name: agent.name || '',
    agent_type: agent.agent_type === 'inbound' || agent.agent_type === 'outbound' || agent.agent_type === 'custom' ? 'voice' : agent.agent_type || 'voice',
    voice_type: agent.agent_type === 'inbound' || agent.agent_type === 'outbound' || agent.agent_type === 'custom' ? agent.agent_type : 'inbound',
    description: agent.description || agent.configuration?.description || '',
    environment: agent.environment || 'dev',
    is_active: agent.is_active ?? true,
    field_extractor: agent.field_extractor ?? false,
    field_extractor_prompt: agent.field_extractor_prompt || '',
    platform_mode: agent.platform_mode || 'pag',
    billing_cycle: agent.billing_cycle || 'monthly',
    s3_enabled: agent.configuration?.s3_enabled ?? false,
    s3_storage_gb: agent.s3_storage_gb || projectData?.s3_default_storage_gb || 50,
    s3_cost_override: agent.configuration?.s3_cost_override || null,
    stt_provider_id: agent.provider_config?.stt?.provider_id?.toString() || '',
    stt_mode: agent.provider_config?.mode === 'builtin' ? 'builtin' : 'external',
    tts_provider_id: agent.provider_config?.tts?.provider_id?.toString() || '',
    tts_mode: agent.provider_config?.mode === 'builtin' ? 'builtin' : 'external',
    llm_provider_id: agent.provider_config?.llm?.provider_id?.toString() || '',
    llm_mode: agent.provider_config?.mode === 'builtin' ? 'builtin' : 'external',
    cost_overrides: {
      stt_price: null as string | null,
      stt_url: null as string | null,
      stt_token: null as string | null,
      tts_price: null as string | null,
      tts_url: null as string | null,
      tts_token: null as string | null,
      llm_price: null as string | null,
      llm_url: null as string | null,
      llm_token: null as string | null
    }
  })

  // Sync platform selection with form data
  useEffect(() => {
    setSelectedPlatform(formData.platform_mode)
  }, [formData.platform_mode])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Get providers by type
  const sttProviders = getProvidersByType(providers, 'STT')
  const ttsProviders = getProvidersByType(providers, 'TTS')  
  const llmProviders = getProvidersByType(providers, 'LLM')

  // Track changes
  useEffect(() => {
    const originalAgentType = agent.agent_type === 'inbound' || agent.agent_type === 'outbound' || agent.agent_type === 'custom' ? 'voice' : agent.agent_type || 'voice'
    const originalVoiceType = agent.agent_type === 'inbound' || agent.agent_type === 'outbound' || agent.agent_type === 'custom' ? agent.agent_type : 'inbound'
    
    const hasChanged = 
      formData.name !== (agent.name || '') ||
      formData.agent_type !== originalAgentType ||
      (formData.agent_type === 'voice' && formData.voice_type !== originalVoiceType) ||
      formData.description !== (agent.description || agent.configuration?.description || '') ||
      formData.environment !== (agent.environment || 'dev') ||
      formData.is_active !== (agent.is_active ?? true) ||
      formData.field_extractor !== (agent.field_extractor ?? false) ||
      formData.field_extractor_prompt !== (agent.field_extractor_prompt || '') ||
      formData.platform_mode !== (agent.platform_mode || 'pag') ||
      formData.billing_cycle !== (agent.billing_cycle || 'monthly') ||
      formData.s3_enabled !== (agent.configuration?.s3_enabled ?? false) ||
      formData.s3_storage_gb !== (agent.s3_storage_gb || projectData?.s3_default_storage_gb || 50) ||
      formData.s3_cost_override !== (agent.configuration?.s3_cost_override || null) ||
      formData.stt_provider_id !== (agent.provider_config?.stt?.provider_id?.toString() || '') ||
      formData.tts_provider_id !== (agent.provider_config?.tts?.provider_id?.toString() || '') ||
      formData.llm_provider_id !== (agent.provider_config?.llm?.provider_id?.toString() || '')
    
    setHasChanges(hasChanged)
  }, [formData, agent, projectData])

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
      const updateData = {
        name: formData.name.trim(),
        agent_type: formData.agent_type === 'voice' ? formData.voice_type : formData.agent_type,
        description: formData.description,
        environment: formData.environment,
        is_active: formData.is_active,
        field_extractor: formData.field_extractor,
        field_extractor_prompt: formData.field_extractor_prompt,
        platform_mode: formData.platform_mode,
        billing_cycle: formData.billing_cycle,
        provider_config: {
          stt: { provider_id: formData.stt_provider_id ? parseInt(formData.stt_provider_id) : null },
          tts: { provider_id: formData.tts_provider_id ? parseInt(formData.tts_provider_id) : null },
          llm: { provider_id: formData.llm_provider_id ? parseInt(formData.llm_provider_id) : null },
          mode: formData.stt_mode === 'builtin' && formData.tts_mode === 'builtin' && formData.llm_mode === 'builtin' ? 'builtin' : 'external'
        },
        s3_storage_gb: formData.s3_storage_gb,
        configuration: {
          ...agent.configuration,
          s3_enabled: formData.s3_enabled,
          s3_cost_override: formData.s3_cost_override,
          description: formData.description
        },
        pricing_config: formData.cost_overrides
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
    <div className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center border border-gray-100 dark:border-slate-600">
            <Settings className="w-6 h-6 text-gray-700 dark:text-gray-200" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Agent Settings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure your AI agent settings
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-5 pb-6">
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

          {/* Platform Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Pricing Mode
            </label>
            <div className="flex gap-2">
              {PLATFORM_MODES.map((platform) => {
                const Icon = platform.icon
                const isSelected = selectedPlatform === platform.value
                
                return (
                  <div
                    key={platform.value}
                    className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 flex-1 ${
                      isSelected 
                        ? platform.color === 'green'
                          ? 'border-[#328c81] bg-teal-50 dark:bg-teal-900/20 dark:border-teal-600'
                          : platform.color === 'purple'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500'
                          : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                    }`}
                    onClick={() => {
                      setSelectedPlatform(platform.value)
                      handleInputChange('platform_mode', platform.value)
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected 
                        ? platform.color === 'green'
                          ? 'bg-[#328c81] text-white'
                          : platform.color === 'purple'
                          ? 'bg-purple-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{platform.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{platform.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Billing Cycle */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Cycle de Facturation
            </label>
            <Select value={formData.billing_cycle} onValueChange={(value) => handleInputChange('billing_cycle', value)}>
              <SelectTrigger className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Sélectionnez le cycle" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                <SelectItem value="monthly" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">Mensuel</SelectItem>
                <SelectItem value="annual" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">Annuel (avec réduction)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Agent Name
            </label>
            <Input
              placeholder="Customer Support Bot"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Agent Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Agent Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_TYPES.map((type) => {
                const Icon = type.icon
                const isSelected = formData.agent_type === type.value
                
                return (
                  <div
                    key={type.value}
                    className={`relative p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 shadow-sm' 
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                    }`}
                    onClick={() => handleInputChange('agent_type', type.value)}
                  >
                    <div className="text-center">
                      <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-0.5">{type.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{type.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Voice Type - only for voice agents */}
          {formData.agent_type === 'voice' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Voice Type
              </label>
              <Select value={formData.voice_type} onValueChange={(value) => handleInputChange('voice_type', value)}>
                <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                  <SelectValue placeholder="Select voice type" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                  {VOICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">
                      {type.label} - {type.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Description (Optional)
            </label>
            <Input
              placeholder="Brief description of the agent's purpose"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Environment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Environment
            </label>
            <Select value={formData.environment} onValueChange={(value) => handleInputChange('environment', value)}>
              <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                <SelectItem value="dev" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">Development</SelectItem>
                <SelectItem value="staging" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">Staging</SelectItem>
                <SelectItem value="production" className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agent Status */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Agent Status
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">Enable or disable this agent</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => handleInputChange('is_active', checked)}
            />
          </div>


          {/* Provider Selection - For PAG and Hybrid modes */}
          {(formData.platform_mode === 'pag' || formData.platform_mode === 'hybrid') && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                AI Provider Mode
              </div>
              
              {formData.platform_mode === 'pag' && (
                <div className="flex gap-2">
                  <div
                    className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      formData.stt_mode === 'builtin' && formData.tts_mode === 'builtin' && formData.llm_mode === 'builtin'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                    }`}
                    onClick={() => {
                      handleInputChange('stt_mode', 'builtin')
                      handleInputChange('tts_mode', 'builtin')
                      handleInputChange('llm_mode', 'builtin')
                    }}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Built-in Models</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Use internal AI models</div>
                    </div>
                  </div>
                  
                  <div
                    className={`flex-1 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                      formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                    }`}
                    onClick={() => {
                      handleInputChange('stt_mode', 'external')
                      handleInputChange('tts_mode', 'external')
                      handleInputChange('llm_mode', 'external')
                    }}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">External Providers</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Use external AI services</div>
                    </div>
                  </div>
                </div>
              )}

              {/* External Provider Selection */}
              {(formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external' || formData.platform_mode === 'hybrid') && (
                <div className="space-y-4">
                  {providersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2">Loading providers...</span>
                    </div>
                  ) : (
                    <>
                      {/* STT Provider */}
                      {formData.agent_type === 'voice' && (formData.stt_mode === 'external' || formData.platform_mode === 'hybrid') && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT Provider</label>
                          {formData.platform_mode === 'hybrid' && (
                            <div className="flex gap-2 mb-2">
                              <Button
                                type="button"
                                variant={formData.stt_mode === 'builtin' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('stt_mode', 'builtin')}
                                className="text-xs"
                              >
                                Built-in
                              </Button>
                              <Button
                                type="button"
                                variant={formData.stt_mode === 'external' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('stt_mode', 'external')}
                                className="text-xs"
                              >
                                External
                              </Button>
                            </div>
                          )}
                          {formData.stt_mode === 'external' && (
                            <Select value={formData.stt_provider_id} onValueChange={(value) => handleInputChange('stt_provider_id', value)}>
                              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                                <SelectValue placeholder="Select STT provider" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                                {sttProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* TTS Provider */}
                      {formData.agent_type === 'voice' && (formData.tts_mode === 'external' || formData.platform_mode === 'hybrid') && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS Provider</label>
                          {formData.platform_mode === 'hybrid' && (
                            <div className="flex gap-2 mb-2">
                              <Button
                                type="button"
                                variant={formData.tts_mode === 'builtin' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('tts_mode', 'builtin')}
                                className="text-xs"
                              >
                                Built-in
                              </Button>
                              <Button
                                type="button"
                                variant={formData.tts_mode === 'external' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('tts_mode', 'external')}
                                className="text-xs"
                              >
                                External
                              </Button>
                            </div>
                          )}
                          {formData.tts_mode === 'external' && (
                            <Select value={formData.tts_provider_id} onValueChange={(value) => handleInputChange('tts_provider_id', value)}>
                              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                                <SelectValue placeholder="Select TTS provider" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                                {ttsProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {/* LLM Provider */}
                      {(formData.llm_mode === 'external' || formData.platform_mode === 'hybrid') && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM Provider</label>
                          {formData.platform_mode === 'hybrid' && (
                            <div className="flex gap-2 mb-2">
                              <Button
                                type="button"
                                variant={formData.llm_mode === 'builtin' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('llm_mode', 'builtin')}
                                className="text-xs"
                              >
                                Built-in
                              </Button>
                              <Button
                                type="button"
                                variant={formData.llm_mode === 'external' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleInputChange('llm_mode', 'external')}
                                className="text-xs"
                              >
                                External
                              </Button>
                            </div>
                          )}
                          {formData.llm_mode === 'external' && (
                            <Select value={formData.llm_provider_id} onValueChange={(value) => handleInputChange('llm_provider_id', value)}>
                              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                                <SelectValue placeholder="Select LLM provider" />
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                                {llmProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()} className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* S3 Storage - only for voice agents */}
          {formData.agent_type === 'voice' && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                S3 Storage Configuration
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Enable S3 Storage
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Store call recordings in S3</p>
                </div>
                <Switch
                  checked={formData.s3_enabled}
                  onCheckedChange={(checked) => handleInputChange('s3_enabled', checked)}
                />
              </div>
              
              {formData.s3_enabled && (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Storage Amount (GB)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.s3_storage_gb}
                      onChange={(e) => handleInputChange('s3_storage_gb', parseInt(e.target.value) || 50)}
                      placeholder="50"
                      className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Cost Override ($/GB/month)
                      </label>
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.s3_cost_override || ''}
                        onChange={(e) => handleInputChange('s3_cost_override', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Leave empty for default pricing"
                        className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Cost Overrides - Super Admin only */}
          {isSuperAdmin && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Cost Overrides
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCostOverrides(!showCostOverrides)}
                  className="text-xs"
                >
                  {showCostOverrides ? 'Hide' : 'Show'} Overrides
                </Button>
              </div>
              
              {showCostOverrides && (
                <div className="space-y-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Override default pricing for this agent. Leave empty to use global settings.
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {formData.agent_type === 'voice' && (
                      <>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT Cost Override (per minute)</label>
                          <Input
                            type="number"
                            step="0.001"
                            value={formData.cost_overrides.stt_price || ''}
                            onChange={(e) => handleInputChange('cost_overrides', { ...formData.cost_overrides, stt_price: e.target.value || null })}
                            placeholder="0.005"
                            className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS Cost Override (per word)</label>
                          <Input
                            type="number"
                            step="0.001"
                            value={formData.cost_overrides.tts_price || ''}
                            onChange={(e) => handleInputChange('cost_overrides', { ...formData.cost_overrides, tts_price: e.target.value || null })}
                            placeholder="0.002"
                            className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM Cost Override (per token)</label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={formData.cost_overrides.llm_price || ''}
                        onChange={(e) => handleInputChange('cost_overrides', { ...formData.cost_overrides, llm_price: e.target.value || null })}
                        placeholder="0.000015"
                        className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Advanced Settings */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Advanced Settings
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Field Extractor
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">Enable field extraction from call transcripts</p>
              </div>
              <Switch
                checked={formData.field_extractor}
                onCheckedChange={(checked) => handleInputChange('field_extractor', checked)}
              />
            </div>

            {formData.field_extractor && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Field Extractor Prompt
                </label>
                <Textarea
                  value={formData.field_extractor_prompt}
                  onChange={(e) => handleInputChange('field_extractor_prompt', e.target.value)}
                  placeholder="Enter field extraction prompt..."
                  rows={3}
                  className="text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
        <Button 
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          className="w-full flex items-center justify-center gap-2 h-10"
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
