"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, Bot, Phone, PhoneCall, Settings, ArrowRight, Copy, AlertCircle, Zap, Cpu, Link as LinkIcon, Brain, Server } from 'lucide-react'
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

interface VapiAssistant {
  id: string;
  name: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  model: any;
  voice: any;
  transcriber: any;
  firstMessage?: string;
  agent_type?: string;
  environment?: string;
  is_active?: boolean;
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
  },
  { 
    value: 'vision', 
    label: 'Vision Agent',
    description: 'Coming Soon',
    icon: Settings,
    disabled: true
  }
]

const VOICE_TYPES = [
  { 
    value: 'inbound', 
    label: 'Inbound',
    description: 'Handle incoming calls',
    icon: Phone,
  },
  { 
    value: 'outbound', 
    label: 'Outbound',
    description: 'Make automated calls',
    icon: PhoneCall,
  },
  { 
    value: 'custom', 
    label: 'Custom',
    description: 'Specialized agent',
    icon: Settings,
  }
]

const PRICING_MODES = [
  {
    value: 'pay_as_you_go',
    label: 'Pay-as-You-Go',
    description: 'Pay per usage',
    icon: Zap,
  },
  {
    value: 'dedicated',
    label: 'Dedicated',
    description: 'Monthly subscription',
    icon: Cpu,
  }
]

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'connecting' | 'success'>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('pag')
  const assistantSectionRef = useRef<HTMLDivElement>(null)
  const { providers, globalSettings, loading: providersLoading } = useProviders()
  const { agent, updateOverrides, resetOverrides } = useCostOverrides(null)
  const { globalRole, isSuperAdmin } = useGlobalRole()
  const [showCostOverrides, setShowCostOverrides] = useState(false)
  const [tempCostOverrides, setTempCostOverrides] = useState<any>({})
  
  // Agent form fields with new pricing architecture
  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'voice',
    voice_type: 'inbound', 
    description: '',
    platform_mode: selectedPlatform, // 'dedicated', 'pag', 'hybrid'
    pricing_config: {}, // Configuration spécifique selon mode
    s3_storage_gb: 50, // Storage S3 par défaut
    billing_cycle: 'monthly', // 'monthly' ou 'yearly'
    stt_provider_id: '',
    stt_mode: 'builtin', // 'builtin_dedicated', 'builtin_pag', 'external_pag'
    tts_provider_id: '',
    tts_mode: 'builtin',
    llm_provider_id: '',
    llm_mode: 'builtin'
  })

  // Vapi agent fields
  const [vapiData, setVapiData] = useState<{
    apiKey: string;
    projectApiKey: string;
    availableAssistants: VapiAssistant[];
    selectedAssistantId: string;
    connectLoading: boolean;
  }>({
    apiKey: '',
    projectApiKey: '',
    availableAssistants: [],
    selectedAssistantId: '',
    connectLoading: false
  });

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [webhookSetupStatus, setWebhookSetupStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null)

  const selectedAgentType = AGENT_TYPES.find(type => type.value === formData.agent_type)
  const selectedVoiceType = VOICE_TYPES.find(type => type.value === formData.voice_type)
  
  // Get providers by type for dropdowns
  const sttProviders = getProvidersByType(providers, 'STT')
  const ttsProviders = getProvidersByType(providers, 'TTS')
  const llmProviders = getProvidersByType(providers, 'LLM')
  
  // Calculate estimated cost per minute
  const getEstimatedCost = () => {
    if (formData.platform_mode === 'pag' && globalSettings) {
      if (formData.agent_type === 'voice') {
        // Pour voice: STT + TTS + LLM
        const sttCost = globalSettings.builtin_stt?.cost_per_minute || 0
        const ttsCost = (globalSettings.builtin_tts?.cost_per_word || 0) * 100 // ~100 words/min 
        const llmCost = (globalSettings.builtin_llm?.cost_per_token || 0) * 1000 // ~1000 tokens/min
        return sttCost + ttsCost + llmCost
      } else if (formData.agent_type === 'text_only') {
        // Pour text-only, seulement LLM
        return (globalSettings.builtin_llm?.cost_per_token || 0) * 1000
      }
    } else if (formData.platform_mode === 'pag' && formData.stt_mode === 'external') {
      const sttProvider = sttProviders.find(p => p.id.toString() === formData.stt_provider_id)
      const ttsProvider = ttsProviders.find(p => p.id.toString() === formData.tts_provider_id)
      const llmProvider = llmProviders.find(p => p.id.toString() === formData.llm_provider_id)
      
      let totalCost = 0
      if (formData.agent_type === 'voice') {
        if (sttProvider) totalCost += sttProvider.cost_per_unit // per minute
        if (ttsProvider) totalCost += ttsProvider.cost_per_unit * 100 // estimated 100 words per minute
      }
      if (llmProvider) totalCost += llmProvider.cost_per_unit * 1000 // estimated 1000 tokens per minute
      
      return totalCost
    }
    return 0
  }

  // Scroll to assistant section after successful connection
  useEffect(() => {
    if (vapiData.availableAssistants.length > 0 && assistantSectionRef.current) {
      setTimeout(() => {
        assistantSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        })
      }, 100)
    }
  }, [vapiData.availableAssistants.length])

  const handleVapiConnect = async () => {
    if (!vapiData.apiKey.trim()) {
      setError('Vapi API key is required')
      return
    }

    setVapiData(prev => ({ ...prev, connectLoading: true }))
    setError(null)

    try {
      console.log('🔑 Connecting directly to Vapi API with key:', vapiData.apiKey.slice(0, 10) + '...')
      
      // Call Vapi API directly - keeping original functionality
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiData.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Vapi API error:', errorText)
        
        // Parse error message if possible
        let errorMessage = `Failed to connect to Vapi: ${response.status}`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch (e) {
          if (errorText) errorMessage = errorText
        }
        
        throw new Error(errorMessage)
      }

      const assistants = await response.json()
      console.log('✅ Vapi assistants fetched directly:', assistants)
      
      setVapiData(prev => ({
        ...prev,
        availableAssistants: assistants || [],
        connectLoading: false
      }))
      
    } catch (err) {
      console.error('💥 Error connecting to Vapi:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to Vapi')
      setVapiData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  // New function to setup webhook after agent creation
  const setupVapiWebhook = async (agentId: string) => {
    try {
      console.log('🔗 Setting up Vapi webhook for agent:', agentId)
      
      const response = await fetch(`/api/agents/${agentId}/vapi/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup webhook')
      }
      
      console.log('✅ Webhook setup successful:', data)
      setWebhookSetupStatus({
        success: true,
        message: 'Webhook configured successfully! Agent is ready to use.'
      })
      
      return data
      
    } catch (error) {
      console.error('❌ Failed to setup webhook:', error)
      setWebhookSetupStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to setup webhook'
      })
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedPlatform === 'livekit') {
      if (!formData.name.trim()) {
        setError('Agent name is required')
        return
      }
      
      // Additional validation for external providers
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
    } else if (selectedPlatform === 'vapi') {
      if (!formData.name.trim()) {
        setError('Agent name is required')
        return
      }
      if (!vapiData.selectedAssistantId) {
        setError('Please select an assistant')
        return
      }
      if (!vapiData.projectApiKey.trim()) {
        setError('Project API key is required')
        return
      }
    }

    setLoading(true)
    setCurrentStep('creating')

    try {
      let payload

      if (selectedPlatform === 'livekit') {
        // Build provider config based on mode
        let providerConfig: any = {}
        
        if (formData.platform_mode === 'dedicated' || (formData.platform_mode === 'pag' && formData.stt_mode === 'builtin')) {
          providerConfig = {
            mode: 'builtin'
          }
        } else {
          providerConfig = {
            mode: 'external'
          }
          
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
        
        payload = {
          name: formData.name.trim(),
          agent_type: formData.agent_type,
          platform_mode: formData.platform_mode,
          configuration: {
            description: formData.description.trim() || null,
            voice_type: formData.agent_type === 'voice' ? formData.voice_type : null
          },
          provider_config: providerConfig,
          cost_overrides: Object.keys(tempCostOverrides).length > 0 ? tempCostOverrides : null,
          project_id: projectId,
          environment: 'dev',
          platform: 'livekit'
        }
      } else {
        const selectedAssistant = vapiData.availableAssistants.find((a: VapiAssistant) => a.id === vapiData.selectedAssistantId)
        payload = {
          name: formData.name.trim(),
          agent_type: 'vapi',
          configuration: {
            vapi: {
              apiKey: vapiData.apiKey.trim(),
              projectApiKey: vapiData.projectApiKey.trim(),
              assistantId: vapiData.selectedAssistantId,
              assistantName: selectedAssistant?.name,
              model: selectedAssistant?.model,
              voice: selectedAssistant?.voice
            }
          },
          project_id: projectId,
          environment: 'dev',
          platform: 'vapi'
        }
      }

      // Step 1: Create the agent
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create agent')
      }

      const data = await response.json()
      console.log('✅ Agent created successfully:', data)
      
      setCreatedAgentData(data)

      // Step 2: Apply cost overrides if provided (super admin)
      if (Object.keys(tempCostOverrides).length > 0 && isSuperAdmin) {
        try {
          await fetch(`/api/agents/${data.id}/cost-overrides`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cost_overrides: tempCostOverrides }),
          });
          console.log('✅ Cost overrides applied successfully');
        } catch (overrideError) {
          console.warn('⚠️ Failed to apply cost overrides:', overrideError);
        }
      }
      
      // Step 3: If it's a Vapi agent, automatically setup webhook
      if (selectedPlatform === 'vapi') {
        setCurrentStep('connecting')
        setWebhookSetupStatus(null)
        
        try {
          await setupVapiWebhook(data.id)
          // Small delay to show the connecting state
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (webhookError) {
          // Don't fail the entire process if webhook setup fails
          // The agent is still created, user can setup webhook later
          console.warn('⚠️ Webhook setup failed, but agent was created successfully')
        }
      }
      
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('💥 Error creating agent:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent'
      setError(errorMessage)
      setCurrentStep('form')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading && !vapiData.connectLoading) {
      setCurrentStep('form')
      setSelectedPlatform('livekit')
      setFormData({ 
        name: '', 
        agent_type: 'voice', 
        voice_type: 'inbound', 
        description: '',
        platform_mode: selectedPlatform,
        pricing_config: {},
        s3_storage_gb: 50,
        billing_cycle: 'monthly',
        stt_provider_id: '',
        stt_mode: 'builtin',
        tts_provider_id: '',
        tts_mode: 'builtin',
        llm_provider_id: '',
        llm_mode: 'builtin'
      })
      setTempCostOverrides({})
      setShowCostOverrides(false)
      setVapiData({ apiKey: '', projectApiKey: '', availableAssistants: [], selectedAssistantId: '', connectLoading: false })
      setError(null)
      setCreatedAgentData(null)
      setCopiedId(false)
      setWebhookSetupStatus(null)
      onClose()
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    handleClose()
  }

  const handleCopyId = async () => {
    if (createdAgentData?.id) {
      try {
        await navigator.clipboard.writeText(createdAgentData.id)
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } catch (err) {
        console.error('Failed to copy agent ID:', err)
      }
    }
  }

  // Render creating/connecting states
  if (currentStep === 'creating' || currentStep === 'connecting') {
    return (
      <Dialog open={isOpen} onOpenChange={() => {}}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800">
          <div className="px-6 py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/30 dark:to-teal-900/30 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-slate-700">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {currentStep === 'creating' ? 'Creating Agent' : 'Connecting with Vapi'}
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              {currentStep === 'creating' 
                ? 'Setting up your new agent...' 
                : 'Configuring webhook integration...'}
            </p>

            {selectedPlatform === 'vapi' && (
              <div className="space-y-3 max-w-xs mx-auto">
                <div className={`flex items-center gap-3 text-sm ${
                  currentStep === 'creating' ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    currentStep === 'creating' 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {currentStep === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
                  </div>
                  <span className={currentStep === 'creating' ? 'font-medium' : ''}>
                    Creating Agent
                  </span>
                </div>
                
                <div className={`flex items-center gap-3 text-sm ${
                  currentStep === 'connecting' ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    currentStep === 'connecting' 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400'
                  }`}>
                    {currentStep === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : '2'}
                  </div>
                  <span className={currentStep === 'connecting' ? 'font-medium' : ''}>
                    Setting up Webhook
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] flex flex-col">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center border border-gray-100 dark:border-slate-600">
                  <Bot className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </div>
                <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  Create New Agent
                </DialogTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose your platform and configure your AI agent
                </p>
              </div>
            </DialogHeader>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-5 pb-6">
                {/* Platform Selection - Compact Style */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Select Platform
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
                          <input
                            type="radio"
                            name="platform"
                            value={platform.value}
                            checked={isSelected}
                            onChange={() => setSelectedPlatform(platform.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Agent Name - Always shown */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Agent Name
                  </label>
                  <Input
                    placeholder={selectedPlatform === 'vapi' ? "My Vapi Agent" : "Customer Support Bot"}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={loading}
                    className="h-10 px-3 text-sm border-gray-200 dark:border-slate-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Livekit Fields */}
                {selectedPlatform === 'livekit' && (
                  <>
                    {/* Agent Type Selection */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        Agent Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {AGENT_TYPES.map((type) => {
                          const Icon = type.icon
                          const isSelected = formData.agent_type === type.value
                          const isDisabled = type.disabled
                          
                          return (
                            <div
                              key={type.value}
                              className={`relative p-3 rounded-lg border transition-all duration-200 ${
                                isDisabled
                                  ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 cursor-not-allowed opacity-60'
                                  : isSelected 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 shadow-sm cursor-pointer' 
                                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer bg-white dark:bg-slate-800'
                              }`}
                              onClick={() => !isDisabled && setFormData({ ...formData, agent_type: type.value })}
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

                    {/* Voice Type Selection - only for voice agents */}
                    {formData.agent_type === 'voice' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                          Voice Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {VOICE_TYPES.map((type) => {
                            const Icon = type.icon
                            const isSelected = formData.voice_type === type.value
                            
                            return (
                              <div
                                key={type.value}
                                className={`relative p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500 shadow-sm' 
                                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800'
                                }`}
                                onClick={() => setFormData({ ...formData, voice_type: type.value })}
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
                    )}

                    {/* S3 Storage Configuration */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        S3 Storage Allocation
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formData.s3_storage_gb} GB included
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            $0.10/GB per month for additional storage
                          </div>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          ${(formData.s3_storage_gb * 0.10).toFixed(2)}/month
                        </div>
                      </div>
                    </div>

                    {/* Provider Mode Selection - Only for PAG */}
                    {formData.platform_mode === 'pag' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                          AI Provider Mode
                        </label>
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
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                              ${getEstimatedCost().toFixed(4)}/minute
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* External Provider Selection - Only for PAG + External */}
                    {formData.platform_mode === 'pag' && (formData.stt_mode === 'external' || formData.tts_mode === 'external' || formData.llm_mode === 'external') && (
                      <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                          Select AI Providers
                        </div>
                        
                        {/* STT Provider - only for voice agents */}
                        {formData.agent_type === 'voice' && (
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Speech-to-Text (STT) Provider
                            </label>
                            <Select value={formData.stt_provider_id} onValueChange={(value) => setFormData({ ...formData, stt_provider_id: value })}>
                              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                                <SelectValue placeholder="Select STT provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {sttProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{provider.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        ${typeof provider.cost_per_unit === 'number' ? provider.cost_per_unit.toFixed(4) : provider.cost_per_unit}/{provider.unit}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* TTS Provider - only for voice agents */}
                        {formData.agent_type === 'voice' && (
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              Text-to-Speech (TTS) Provider
                            </label>
                            <Select value={formData.tts_provider_id} onValueChange={(value) => setFormData({ ...formData, tts_provider_id: value })}>
                              <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                                <SelectValue placeholder="Select TTS provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {ttsProviders.map((provider) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                    <div className="flex items-center justify-between w-full">
                                      <span>{provider.name}</span>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                        ${typeof provider.cost_per_unit === 'number' ? provider.cost_per_unit.toFixed(6) : provider.cost_per_unit}/{provider.unit}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* LLM Provider - for all agent types */}
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Large Language Model (LLM) Provider
                          </label>
                          <Select value={formData.llm_provider_id} onValueChange={(value) => setFormData({ ...formData, llm_provider_id: value })}>
                            <SelectTrigger className="h-9 text-sm bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100">
                              <SelectValue placeholder="Select LLM provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {llmProviders.map((provider) => (
                                <SelectItem key={provider.id} value={provider.id.toString()}>
                                  <div className="flex items-center justify-between w-full">
                                    <span>{provider.name}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                      ${typeof provider.cost_per_unit === 'number' ? provider.cost_per_unit.toFixed(6) : provider.cost_per_unit}/{provider.unit}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Cost Estimation */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Estimated Cost per Minute
                          </div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${getEstimatedCost().toFixed(4)}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Based on average usage: 1 min STT + 100 words TTS + 1000 tokens LLM
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cost Overrides Section - Super Admin Only */}
                    {isSuperAdmin && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                            Cost Overrides
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCostOverrides(!showCostOverrides)}
                            className="text-xs"
                          >
                            {showCostOverrides ? 'Hide' : 'Configure'}
                          </Button>
                        </div>
                        
                        {showCostOverrides && (
                          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                Super Admin: Override costs for this agent
                              </span>
                            </div>
                            
                            {/* Built-in model cost overrides */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">STT Cost Override</label>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  placeholder="0.0050"
                                  value={tempCostOverrides.builtin_stt_cost || ''}
                                  onChange={(e) => setTempCostOverrides({
                                    ...tempCostOverrides,
                                    builtin_stt_cost: parseFloat(e.target.value) || undefined
                                  })}
                                  className="h-8 text-xs bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">TTS Cost Override</label>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  placeholder="0.0020"
                                  value={tempCostOverrides.builtin_tts_cost || ''}
                                  onChange={(e) => setTempCostOverrides({
                                    ...tempCostOverrides,
                                    builtin_tts_cost: parseFloat(e.target.value) || undefined
                                  })}
                                  className="h-8 text-xs bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">LLM Cost Override</label>
                                <Input
                                  type="number"
                                  step="0.000001"
                                  placeholder="0.000015"
                                  value={tempCostOverrides.builtin_llm_cost || ''}
                                  onChange={(e) => setTempCostOverrides({
                                    ...tempCostOverrides,
                                    builtin_llm_cost: parseFloat(e.target.value) || undefined
                                  })}
                                  className="h-8 text-xs bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">S3 Storage Cost/GB</label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.10"
                                  value={tempCostOverrides.s3_storage_cost_per_gb || ''}
                                  onChange={(e) => setTempCostOverrides({
                                    ...tempCostOverrides,
                                    s3_storage_cost_per_gb: parseFloat(e.target.value) || undefined
                                  })}
                                  className="h-8 text-xs bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-gray-100"
                                />
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setTempCostOverrides({})}
                                className="text-xs"
                              >
                                Reset
                              </Button>
                              <div className="text-xs text-amber-700 dark:text-amber-300 flex items-center">
                                Overrides will be applied after agent creation
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 h-10 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={loading || !formData.name.trim()}
                  className="flex-1 h-10 font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Agent'
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Success Screen */}
            <div className="text-center p-6">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Agent Created Successfully!
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Your agent is ready to handle voice conversations
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Create Another
                </Button>
                <Button 
                  onClick={handleFinish}
                  className="flex-1"
                >
                  Configure
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AgentCreationDialog
