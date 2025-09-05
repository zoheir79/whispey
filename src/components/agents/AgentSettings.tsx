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
import { AlertCircle, Check, Loader2, Save, Settings, Phone, Bot, Brain, Server, Zap, Database, Cloud, DollarSign, Edit } from 'lucide-react'
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
}

interface AgentSettingsProps {
  agent: Agent
  onAgentUpdate: (updatedAgent: Agent) => void
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

export default function AgentSettings({ agent, onAgentUpdate }: AgentSettingsProps) {
  const { providers, globalSettings, loading: providersLoading } = useProviders()
  const { agent: costAgent, updateOverrides, resetOverrides } = useCostOverrides(null)
  const { globalRole, isSuperAdmin } = useGlobalRole()
  const [showCostOverrides, setShowCostOverrides] = useState(false)
  const [tempCostOverrides, setTempCostOverrides] = useState<any>({})
  
  const [formData, setFormData] = useState({
    name: agent.name || '',
    agent_type: agent.agent_type || 'voice',
    voice_type: agent.agent_type || 'inbound',
    description: agent.configuration?.description || '',
    environment: agent.environment || 'dev',
    is_active: agent.is_active ?? true,
    field_extractor: agent.field_extractor ?? false,
    field_extractor_prompt: agent.field_extractor_prompt || '',
    platform_mode: agent.platform_mode || 'pag',
    billing_cycle: agent.billing_cycle || 'monthly',
    s3_enabled: agent.configuration?.s3_enabled || false,
    s3_storage_gb: agent.s3_storage_gb || 50,
    s3_cost_override: agent.configuration?.s3_cost_override || null,
    stt_provider_id: agent.provider_config?.stt_provider || '',
    stt_mode: agent.provider_config?.stt_provider ? 'external' : 'builtin',
    tts_provider_id: agent.provider_config?.tts_provider || '',
    tts_mode: agent.provider_config?.tts_provider ? 'external' : 'builtin', 
    llm_provider_id: agent.provider_config?.llm_provider || '',
    llm_mode: agent.provider_config?.llm_provider ? 'external' : 'builtin',
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
    },
    configuration: JSON.stringify(agent.configuration || {}, null, 2)
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Get providers by type
  const sttProviders = getProvidersByType(providers, 'STT')
  const ttsProviders = getProvidersByType(providers, 'TTS')  
  const llmProviders = getProvidersByType(providers, 'LLM')
  
  // Selected platform state
  const [selectedPlatform, setSelectedPlatform] = useState(agent.platform_mode || 'pag')

  // Track changes
  useEffect(() => {
    const hasChanged = 
      formData.name !== agent.name ||
      formData.agent_type !== agent.agent_type ||
      formData.voice_type !== agent.agent_type ||
      formData.description !== (agent.configuration?.description || '') ||
      formData.environment !== agent.environment ||
      formData.is_active !== agent.is_active ||
      formData.field_extractor !== (agent.field_extractor ?? false) ||
      formData.field_extractor_prompt !== (agent.field_extractor_prompt || '') ||
      formData.platform_mode !== (agent.platform_mode || 'pag') ||
      formData.billing_cycle !== (agent.billing_cycle || 'monthly') ||
      formData.s3_enabled !== (agent.configuration?.s3_enabled || false) ||
      formData.s3_storage_gb !== (agent.s3_storage_gb || 50) ||
      formData.configuration !== JSON.stringify(agent.configuration || {}, null, 2) ||
      Object.keys(tempCostOverrides).length > 0
    
    setHasChanges(hasChanged)
  }, [formData, agent, tempCostOverrides])
  
  // Update selected platform when formData changes
  useEffect(() => {
    setSelectedPlatform(formData.platform_mode)
  }, [formData.platform_mode])

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

      // Build provider config based on modes
      const providerConfig: any = {}
      
      if (formData.agent_type === 'voice') {
        if (formData.stt_mode === 'builtin') {
          providerConfig.stt_provider = 'builtin_stt'
        } else if (formData.stt_mode === 'external' && formData.stt_provider_id) {
          providerConfig.stt_provider = formData.stt_provider_id
        }
        
        if (formData.tts_mode === 'builtin') {
          providerConfig.tts_provider = 'builtin_tts'
        } else if (formData.tts_mode === 'external' && formData.tts_provider_id) {
          providerConfig.tts_provider = formData.tts_provider_id
        }
      }
      
      if (formData.llm_mode === 'builtin') {
        providerConfig.llm_provider = 'builtin_llm'
      } else if (formData.llm_mode === 'external' && formData.llm_provider_id) {
        providerConfig.llm_provider = formData.llm_provider_id
      }
      
      const updateData = {
        name: formData.name.trim(),
        agent_type: formData.agent_type === 'voice' ? formData.voice_type : formData.agent_type,
        environment: formData.environment,
        is_active: formData.is_active,
        field_extractor: formData.field_extractor,
        field_extractor_prompt: formData.field_extractor_prompt,
        platform_mode: formData.platform_mode,
        billing_cycle: formData.billing_cycle,
        s3_enabled: formData.agent_type === 'voice' ? formData.s3_enabled : false,
        s3_storage_gb: formData.agent_type === 'voice' && formData.s3_enabled ? formData.s3_storage_gb : 0,
        s3_cost_override: formData.agent_type === 'voice' && formData.s3_enabled ? formData.s3_cost_override : null,
        provider_config: providerConfig,
        cost_overrides: Object.keys(tempCostOverrides).length > 0 ? tempCostOverrides : null,
        configuration: {
          ...parsedConfig,
          description: formData.description.trim() || null,
          voice_type: formData.agent_type === 'voice' ? formData.voice_type : null,
          billing_cycle: formData.billing_cycle,
          s3_enabled: formData.agent_type === 'voice' ? formData.s3_enabled : false,
          s3_storage_gb: formData.agent_type === 'voice' && formData.s3_enabled ? formData.s3_storage_gb : 0,
          s3_cost_override: formData.agent_type === 'voice' && formData.s3_enabled ? formData.s3_cost_override : null,
          cost_overrides: formData.cost_overrides
        }
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
      
      // Apply cost overrides if provided (super admin)
      if (Object.keys(tempCostOverrides).length > 0 && isSuperAdmin) {
        try {
          await fetch(`/api/agents/${agent.id}/cost-overrides`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cost_overrides: tempCostOverrides }),
          });
        } catch (overrideError) {
          console.warn('⚠️ Failed to apply cost overrides:', overrideError);
        }
      }
      
      onAgentUpdate(updatedAgent)
      setTempCostOverrides({})
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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
          Agent Status
        </label>
        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.is_active}
            onCheckedChange={(checked) => handleInputChange('is_active', checked)}
          />
          <Badge className={`px-2 py-1 text-xs ${formData.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {formData.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Provider Selection - For PAG and Hybrid modes */}
      {(formData.platform_mode === 'pag' || formData.platform_mode === 'hybrid') && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            AI Provider Mode
          </div>
          
          {formData.platform_mode === 'pag' && (
            <div className="space-y-4">
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
                    handleInputChange('stt_provider_id', '')
                    handleInputChange('tts_provider_id', '')
                    handleInputChange('llm_provider_id', '')
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
              
              {/* Show individual provider selects for external mode */}
              {(formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external') && (
                <div className="space-y-4 p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Select External Providers
                  </div>
                  
                  {formData.agent_type === 'voice' && formData.stt_mode === 'external' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT Provider</label>
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
                    </div>
                  )}
                  
                  {formData.agent_type === 'voice' && formData.tts_mode === 'external' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS Provider</label>
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
                    </div>
                  )}
                  
                  {formData.llm_mode === 'external' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM Provider</label>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {formData.platform_mode === 'hybrid' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                En mode Hybrid, choisissez individuellement chaque provider (Built-in, External, ou Dedicated) pour chaque modèle.
              </div>
              
              {/* Individual Provider Selection for Hybrid */}
              {formData.agent_type === 'voice' && (
                <>
                  {/* STT Provider Choice */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT Provider</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={formData.stt_mode === 'builtin' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          handleInputChange('stt_mode', 'builtin')
                          handleInputChange('stt_provider_id', '')
                        }}
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
                      <Button
                        type="button"
                        variant={formData.stt_mode === 'dedicated' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          handleInputChange('stt_mode', 'dedicated')
                          handleInputChange('stt_provider_id', '')
                        }}
                        className="text-xs"
                      >
                        Dedicated
                      </Button>
                    </div>
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

                  {/* TTS Provider Choice */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS Provider</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={formData.tts_mode === 'builtin' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          handleInputChange('tts_mode', 'builtin')
                          handleInputChange('tts_provider_id', '')
                        }}
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
                      <Button
                        type="button"
                        variant={formData.tts_mode === 'dedicated' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          handleInputChange('tts_mode', 'dedicated')
                          handleInputChange('tts_provider_id', '')
                        }}
                        className="text-xs"
                      >
                        Dedicated
                      </Button>
                    </div>
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
                </>
              )}

              {/* LLM Provider Choice */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM Provider</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.llm_mode === 'builtin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      handleInputChange('llm_mode', 'builtin')
                      handleInputChange('llm_provider_id', '')
                    }}
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
                  <Button
                    type="button"
                    variant={formData.llm_mode === 'dedicated' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      handleInputChange('llm_mode', 'dedicated')
                      handleInputChange('llm_provider_id', '')
                    }}
                    className="text-xs"
                  >
                    Dedicated
                  </Button>
                </div>
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
            </div>
          )}
        </div>
      )}

      {/* S3 Configuration - Only for voice agents */}
      {formData.agent_type === 'voice' && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">S3 Storage</div>
            <Switch
              checked={formData.s3_enabled}
              onCheckedChange={(checked) => handleInputChange('s3_enabled', checked)}
            />
          </div>
          
          {formData.s3_enabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Storage Amount (GB)</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.s3_storage_gb}
                  onChange={(e) => handleInputChange('s3_storage_gb', parseInt(e.target.value) || 50)}
                  className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                  placeholder="50"
                />
              </div>
              
              {isSuperAdmin && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost Override ($/GB/month)</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.s3_cost_override || ''}
                    onChange={(e) => handleInputChange('s3_cost_override', e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="Leave empty for default pricing"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cost Overrides - Super Admin Only */}
      {isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Cost Overrides</div>
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
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Override default pricing for this agent. Leave empty to use global settings.
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT Price Override</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={tempCostOverrides.stt_price || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, stt_price: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="Per minute"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS Price Override</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={tempCostOverrides.tts_price || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, tts_price: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="Per word"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM Price Override</label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={tempCostOverrides.llm_price || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, llm_price: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="Per token"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT API URL</label>
                  <Input
                    type="url"
                    value={tempCostOverrides.stt_url || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, stt_url: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="https://api.example.com/stt"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS API URL</label>
                  <Input
                    type="url"
                    value={tempCostOverrides.tts_url || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, tts_url: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="https://api.example.com/tts"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM API URL</label>
                  <Input
                    type="url"
                    value={tempCostOverrides.llm_url || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, llm_url: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="https://api.example.com/llm"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">STT API Token</label>
                  <Input
                    type="password"
                    value={tempCostOverrides.stt_token || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, stt_token: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="API token"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">TTS API Token</label>
                  <Input
                    type="password"
                    value={tempCostOverrides.tts_token || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, tts_token: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="API token"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">LLM API Token</label>
                  <Input
                    type="password"
                    value={tempCostOverrides.llm_token || ''}
                    onChange={(e) => setTempCostOverrides((prev: any) => ({ ...prev, llm_token: e.target.value || null }))}
                    className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                    placeholder="API token"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview Badges */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
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
      <Card className="dark:bg-slate-800 dark:border-slate-700">
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
