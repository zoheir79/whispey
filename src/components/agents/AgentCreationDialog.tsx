"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Bot, Phone, Settings, Zap, Server, Brain } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useProviders, getProvidersByType } from '@/hooks/useProviders'
import { useCostOverrides } from '@/hooks/useCostOverrides'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
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

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'success'>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('pag')
  const { providers, globalSettings, loading: providersLoading } = useProviders()
  const { agent, updateOverrides, resetOverrides } = useCostOverrides(null)
  const { globalRole, isSuperAdmin } = useGlobalRole()
  const [showCostOverrides, setShowCostOverrides] = useState(false)
  const [tempCostOverrides, setTempCostOverrides] = useState<any>({})
  
  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'voice',
    voice_type: 'inbound', 
    description: '',
    platform_mode: 'pag',
    billing_cycle: 'monthly',
    s3_storage_gb: 50,
    stt_provider_id: '',
    stt_mode: 'builtin',
    tts_provider_id: '',
    tts_mode: 'builtin',
    llm_provider_id: '',
    llm_mode: 'builtin',
    // Cost overrides for super admin
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

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  
  const sttProviders = getProvidersByType(providers, 'STT')
  const ttsProviders = getProvidersByType(providers, 'TTS')
  const llmProviders = getProvidersByType(providers, 'LLM')
  
  useEffect(() => {
    setFormData(prev => ({ ...prev, platform_mode: selectedPlatform }))
  }, [selectedPlatform])

  // Force refresh of cost estimation when relevant data changes
  const [estimationKey, setEstimationKey] = useState(0)
  useEffect(() => {
    setEstimationKey(prev => prev + 1)
  }, [formData.agent_type, formData.billing_cycle, selectedPlatform, formData.cost_overrides])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) {
      setError('Agent name is required')
      return
    }
    
    // Validation for external providers
    if (formData.platform_mode === 'pag' && (formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external')) {
      if (formData.agent_type === 'voice') {
        if (!formData.stt_provider_id) {
          setError('Please select an STT provider')
          return
        }
        if (!formData.tts_provider_id) {
          setError('Please select a TTS provider')
          return
        }
      }
      if (!formData.llm_provider_id) {
        setError('Please select an LLM provider')
        return
      }
    }

    setLoading(true)
    setCurrentStep('creating')

    try {
      // Build provider config
      let providerConfig: any = {}
      
      if (formData.platform_mode === 'dedicated' || (formData.platform_mode === 'pag' && formData.stt_mode === 'builtin')) {
        providerConfig = { mode: 'builtin' }
      } else {
        providerConfig = { mode: 'external' }
        
        if (formData.agent_type === 'voice') {
          const sttProvider = sttProviders.find(p => p.id.toString() === formData.stt_provider_id)
          const ttsProvider = ttsProviders.find(p => p.id.toString() === formData.tts_provider_id)
          
          if (sttProvider) {
            providerConfig.stt = {
              provider_id: sttProvider.id,
              cost_per_minute: sttProvider.cost_per_unit
            }
          }
          
          if (ttsProvider) {
            providerConfig.tts = {
              provider_id: ttsProvider.id,
              cost_per_word: ttsProvider.cost_per_unit
            }
          }
        }
        
        const llmProvider = llmProviders.find(p => p.id.toString() === formData.llm_provider_id)
        if (llmProvider) {
          providerConfig.llm = {
            provider_id: llmProvider.id,
            cost_per_token: llmProvider.cost_per_unit
          }
        }
      }
      
      const payload = {
        name: formData.name.trim(),
        agent_type: formData.agent_type,
        platform_mode: formData.platform_mode,
        billing_cycle: formData.billing_cycle,
        s3_storage_gb: formData.s3_storage_gb,
        configuration: {
          description: formData.description.trim() || null,
          voice_type: formData.agent_type === 'voice' ? formData.voice_type : null,
          billing_cycle: formData.billing_cycle,
          s3_storage_gb: formData.s3_storage_gb,
          cost_overrides: formData.cost_overrides
        },
        provider_config: providerConfig,
        cost_overrides: Object.keys(tempCostOverrides).length > 0 ? tempCostOverrides : null,
        project_id: projectId,
        environment: 'dev',
        platform: 'livekit'
      }

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create agent')
      }

      const data = await response.json()
      setCreatedAgentData(data)

      // Apply cost overrides if provided (super admin)
      if (Object.keys(tempCostOverrides).length > 0 && isSuperAdmin) {
        try {
          await fetch(`/api/agents/${data.id}/cost-overrides`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cost_overrides: tempCostOverrides }),
          });
        } catch (overrideError) {
          console.warn('⚠️ Failed to apply cost overrides:', overrideError);
        }
      }
      
      setCurrentStep('success')
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent'
      setError(errorMessage)
      setCurrentStep('form')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCurrentStep('form')
      setSelectedPlatform('pag')
      setFormData({ 
        name: '', 
        agent_type: 'voice', 
        voice_type: 'inbound', 
        description: '',
        platform_mode: 'pag',
        billing_cycle: 'monthly',
        s3_storage_gb: 50,
        stt_provider_id: '',
        stt_mode: 'builtin',
        tts_provider_id: '',
        tts_mode: 'builtin',
        llm_provider_id: '',
        llm_mode: 'builtin',
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
      setTempCostOverrides({})
      setShowCostOverrides(false)
      setError(null)
      setCreatedAgentData(null)
      onClose()
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    handleClose()
  }

  // Creating state
  if (currentStep === 'creating') {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800">
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-700">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Creating Agent</h3>
            <p className="text-sm text-gray-600 mb-6">Setting up your new agent...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Success state
  if (currentStep === 'success') {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800">
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-700">
              <Bot className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Agent Created Successfully!</h3>
            <p className="text-sm text-gray-600 mb-6">Your agent is ready to use</p>
            <Button onClick={handleFinish} className="w-full">
              Continue to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center border border-gray-100 dark:border-slate-600">
              <Bot className="w-6 h-6 text-gray-700 dark:text-gray-200" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Create New Agent
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure your AI agent with pricing mode
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <form onSubmit={handleSubmit} className="space-y-5 pb-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
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
                      onClick={() => setSelectedPlatform(platform.value)}
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
              <Select value={formData.billing_cycle} onValueChange={(value) => setFormData(prev => ({ ...prev, billing_cycle: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez le cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="annual">Annuel (avec réduction)</SelectItem>
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={loading}
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
                      onClick={() => setFormData({ ...formData, agent_type: type.value })}
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
                <Select value={formData.voice_type} onValueChange={(value) => setFormData({ ...formData, voice_type: value })}>
                  <SelectTrigger className="h-10 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Select voice type" />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
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
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
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
                      onClick={() => setFormData({ ...formData, stt_mode: 'builtin', tts_mode: 'builtin', llm_mode: 'builtin' })}
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
                      onClick={() => setFormData({ ...formData, stt_mode: 'external', tts_mode: 'external', llm_mode: 'external' })}
                    >
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">External Providers</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Use external AI services</div>
                      </div>
                    </div>
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
                              onClick={() => setFormData({...formData, stt_mode: 'builtin', stt_provider_id: ''})}
                              className="text-xs"
                            >
                              Built-in
                            </Button>
                            <Button
                              type="button"
                              variant={formData.stt_mode === 'external' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFormData({...formData, stt_mode: 'external'})}
                              className="text-xs"
                            >
                              External
                            </Button>
                            <Button
                              type="button"
                              variant={formData.stt_mode === 'dedicated' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFormData({...formData, stt_mode: 'dedicated', stt_provider_id: ''})}
                              className="text-xs"
                            >
                              Dedicated
                            </Button>
                          </div>
                          {formData.stt_mode === 'external' && (
                            <Select value={formData.stt_provider_id} onValueChange={(value) => setFormData({ ...formData, stt_provider_id: value })}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select STT provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {sttProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
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
                              onClick={() => setFormData({...formData, tts_mode: 'builtin', tts_provider_id: ''})}
                              className="text-xs"
                            >
                              Built-in
                            </Button>
                            <Button
                              type="button"
                              variant={formData.tts_mode === 'external' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFormData({...formData, tts_mode: 'external'})}
                              className="text-xs"
                            >
                              External
                            </Button>
                            <Button
                              type="button"
                              variant={formData.tts_mode === 'dedicated' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFormData({...formData, tts_mode: 'dedicated', tts_provider_id: ''})}
                              className="text-xs"
                            >
                              Dedicated
                            </Button>
                          </div>
                          {formData.tts_mode === 'external' && (
                            <Select value={formData.tts_provider_id} onValueChange={(value) => setFormData({ ...formData, tts_provider_id: value })}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select TTS provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {ttsProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
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
                          onClick={() => setFormData({...formData, llm_mode: 'builtin', llm_provider_id: ''})}
                          className="text-xs"
                        >
                          Built-in
                        </Button>
                        <Button
                          type="button"
                          variant={formData.llm_mode === 'external' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({...formData, llm_mode: 'external'})}
                          className="text-xs"
                        >
                          External
                        </Button>
                        <Button
                          type="button"
                          variant={formData.llm_mode === 'dedicated' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({...formData, llm_mode: 'dedicated', llm_provider_id: ''})}
                          className="text-xs"
                        >
                          Dedicated
                        </Button>
                      </div>
                      {formData.llm_mode === 'external' && (
                        <Select value={formData.llm_provider_id} onValueChange={(value) => setFormData({ ...formData, llm_provider_id: value })}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select LLM provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {llmProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
                                {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}

                {/* External Provider Selection for PAG mode */}
                {formData.platform_mode === 'pag' && (formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external') && (
                  <div className="space-y-3 mt-4">
                    {formData.agent_type === 'voice' && formData.stt_mode === 'external' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          STT Provider
                        </label>
                        <Select value={formData.stt_provider_id} onValueChange={(value) => setFormData({ ...formData, stt_provider_id: value })}>
                          <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                            <SelectValue placeholder="Select STT provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {sttProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
                                {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.agent_type === 'voice' && formData.tts_mode === 'external' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          TTS Provider
                        </label>
                        <Select value={formData.tts_provider_id} onValueChange={(value) => setFormData({ ...formData, tts_provider_id: value })}>
                          <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                            <SelectValue placeholder="Select TTS provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {ttsProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
                                {provider.name} - ${provider.cost_per_unit}/{provider.unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {formData.llm_mode === 'external' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          LLM Provider
                        </label>
                        <Select value={formData.llm_provider_id} onValueChange={(value) => setFormData({ ...formData, llm_provider_id: value })}>
                          <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600">
                            <SelectValue placeholder="Select LLM provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {llmProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id.toString()}>
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

            {/* Cost Estimation */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Estimation des Coûts
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedPlatform === 'dedicated' && (
                  <div>
                    <div className="font-medium">Mode Dedicated:</div>
                    <div>
                      {formData.agent_type === 'voice' ? 'Agent Voice' : 'Agent Text-Only'} 
                      {formData.billing_cycle === 'monthly' ? ' (Mensuel)' : ' (Annuel avec réduction)'}
                    </div>
                    <div className="text-lg font-bold text-green-600 mt-1">
                      {formData.agent_type === 'voice' 
                        ? (formData.billing_cycle === 'monthly' ? 'Estimation: $180/mois' : 'Estimation: $1,800/an')
                        : (formData.billing_cycle === 'monthly' ? 'Estimation: $100/mois' : 'Estimation: $1,000/an')
                      }
                    </div>
                  </div>
                )}
                {selectedPlatform === 'pag' && (
                  <div>
                    <div className="font-medium">Mode Pay-as-You-Go:</div>
                    <div>
                      {formData.agent_type === 'voice' 
                        ? 'Facturation par minute d\'utilisation'
                        : 'Facturation par token LLM utilisé'
                      }
                    </div>
                    <div className="text-lg font-bold text-blue-600 mt-1">
                      {formData.agent_type === 'voice' 
                        ? 'Estimation: $0.05/minute'
                        : 'Estimation: $0.00005/token'
                      }
                    </div>
                  </div>
                )}
                {selectedPlatform === 'hybrid' && (
                  <div>
                    <div className="font-medium">Mode Hybrid:</div>
                    <div>Mix de modèles dedicated et pay-as-you-go</div>
                    <div className="text-lg font-bold text-purple-600 mt-1">
                      {formData.agent_type === 'voice' 
                        ? 'Estimation: $0.03/minute + coûts fixes'
                        : 'Estimation: $0.00003/token + coûts fixes'
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Super Admin Cost Overrides */}
            {isSuperAdmin && (
              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                    🔧 Super Admin - Overrides Modèles
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCostOverrides(!showCostOverrides)}
                  >
                    {showCostOverrides ? 'Masquer' : 'Configurer'}
                  </Button>
                </div>
                
                {showCostOverrides && (
                  <div className="space-y-4">
                    <p className="text-xs text-orange-700 dark:text-orange-300 mb-3">
                      Vous pouvez override les prix, URLs et tokens API des modèles pour cet agent.
                    </p>
                    
                    {formData.agent_type === 'voice' && (
                      <>
                        {/* STT Overrides */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            STT Overrides {formData.stt_mode === 'builtin' ? '(Built-in STT)' : formData.stt_provider_id ? `(${sttProviders.find(p => p.id.toString() === formData.stt_provider_id)?.name || 'Provider'})` : ''}
                          </h4>
                          <p className="text-xs text-gray-500">Remplissez seulement les champs à modifier (optionnel)</p>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder={`Prix $/minute (optionnel)`}
                              type="number"
                              step="0.001"
                              value={formData.cost_overrides.stt_price || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, stt_price: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="URL custom (optionnel)"
                              value={formData.cost_overrides.stt_url || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, stt_url: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="API Token (optionnel)"
                              value={formData.cost_overrides.stt_token || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, stt_token: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        {/* TTS Overrides */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            TTS Overrides {formData.tts_mode === 'builtin' ? '(Built-in TTS)' : formData.tts_provider_id ? `(${ttsProviders.find(p => p.id.toString() === formData.tts_provider_id)?.name || 'Provider'})` : ''}
                          </h4>
                          <p className="text-xs text-gray-500">Remplissez seulement les champs à modifier (optionnel)</p>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              placeholder={`Prix $/${
                                formData.platform_mode === 'pag' && 
                                !(formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external')
                                ? 'minute' : 'mot'
                              } (optionnel)`}
                              type="number"
                              step="0.001"
                              value={formData.cost_overrides.tts_price || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, tts_price: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="URL custom (optionnel)"
                              value={formData.cost_overrides.tts_url || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, tts_url: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                            <Input
                              placeholder="API Token (optionnel)"
                              value={formData.cost_overrides.tts_token || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                cost_overrides: { ...prev.cost_overrides, tts_token: e.target.value || null }
                              }))}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* LLM Overrides */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        LLM Overrides {formData.llm_mode === 'builtin' ? '(Built-in LLM)' : formData.llm_provider_id ? `(${llmProviders.find(p => p.id.toString() === formData.llm_provider_id)?.name || 'Provider'})` : ''}
                      </h4>
                      <p className="text-xs text-gray-500">Remplissez seulement les champs à modifier (optionnel)</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder={`Prix $/${
                            formData.platform_mode === 'pag' && 
                            formData.agent_type === 'voice' &&
                            !(formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external')
                            ? 'minute' : 'token'
                          } (optionnel)`}
                          type="number"
                          step={
                            formData.platform_mode === 'pag' && 
                            formData.agent_type === 'voice' &&
                            !(formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external')
                            ? "0.001" : "0.00001"
                          }
                          value={formData.cost_overrides.llm_price || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cost_overrides: { ...prev.cost_overrides, llm_price: e.target.value || null }
                          }))}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="URL custom (optionnel)"
                          value={formData.cost_overrides.llm_url || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cost_overrides: { ...prev.cost_overrides, llm_url: e.target.value || null }
                          }))}
                          className="h-8 text-xs"
                        />
                        <Input
                          placeholder="API Token (optionnel)"
                          value={formData.cost_overrides.llm_token || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            cost_overrides: { ...prev.cost_overrides, llm_token: e.target.value || null }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={loading || !formData.name.trim()} 
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Agent...
                  </>
                ) : (
                  'Create Agent'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AgentCreationDialog
