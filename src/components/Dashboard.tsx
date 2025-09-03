'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  ChevronLeft,
  BarChart3, 
  List,
  Loader2,
  AlertCircle,
  Database,
  Bot,
  Settings,
  Copy,
  Home,
  Circle,
  CalendarDays,
  Check,
  AlertTriangle,
  Link as LinkIcon
} from 'lucide-react'
import Overview from './Overview'
import CallLogs from './calls/CallLogs'
import CampaignLogs from './campaigns/CampaignLogs'
import AgentSettings from './agents/AgentSettings'
import AgentAnalytics from './agents/AgentAnalytics'
import Header from '@/components/shared/Header'
import FieldExtractorDialog from './FieldExtractorLogs'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DashboardProps {
  agentId: string
}

interface DateRange {
  from: Date | undefined
  to?: Date | undefined
}

interface VapiStatus {
  connected: boolean
  status: string
  message: string
  details?: any
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Date utility functions
const subDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const formatDateISO = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const Dashboard: React.FC<DashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [breadcrumb, setBreadcrumb] = useState<{
    project?: string;
    item?: string;
  }>({
    project: '',
    item: ''
  })
  const [vapiStatus, setVapiStatus] = useState<VapiStatus | null>(null)
  const [vapiStatusLoading, setVapiStatusLoading] = useState(false)
  const [connectingWebhook, setConnectingWebhook] = useState(false)
  
  // Date filter state
  const [quickFilter, setQuickFilter] = useState('7d')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [isCustomRange, setIsCustomRange] = useState(false)


  
  const activeTab = searchParams.get('tab') || 'overview'
  const shouldFetch = agentId && agentId !== 'undefined' && agentId.trim() !== ''

  const quickFilters = [
    { id: '1d', label: '1D', days: 1 },
    { id: '7d', label: '7D', days: 7 },
    { id: '30d', label: '30D', days: 30 }
  ]

  // Date range for API calls
  const apiDateRange = React.useMemo(() => {
    console.log('🔍 Dashboard apiDateRange MEMO recalculating:', { quickFilter, isCustomRange, dateRange })
    
    if (isCustomRange && dateRange.from && dateRange.to) {
      const result = {
        from: formatDateISO(dateRange.from),
        to: formatDateISO(dateRange.to)
      }
      console.log('🔍 Dashboard apiDateRange CUSTOM result:', result)
      return result
    }
    
    const days = quickFilters.find(f => f.id === quickFilter)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    const result = {
      from: formatDateISO(startDate),
      to: formatDateISO(endDate)
    }
    console.log('🔍 Dashboard apiDateRange QUICK result:', result)
    return result
  }, [quickFilter, dateRange, isCustomRange])

  const handleQuickFilter = (filterId: string) => {
    console.log('🔍 Dashboard handleQuickFilter CLICKED:', filterId)
    
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
    
    console.log('🔍 Dashboard NEW DATE RANGE SET:', {
      filterId,
      days,
      startDate: formatDateISO(startDate),
      endDate: formatDateISO(endDate)
    })
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range)
      setIsCustomRange(true)
      setQuickFilter('')
    }
  }

  

  const [agents, setAgents] = React.useState<any[]>([])
  const [agentLoading, setAgentLoading] = React.useState(true)
  const [agentError, setAgentError] = React.useState<string | null>(null)

  const fetchAgent = React.useCallback(async () => {
    if (!shouldFetch || !agentId) {
      setAgents([])
      setAgentLoading(false)
      return
    }

    setAgentLoading(true)
    setAgentError(null)

    try {
      const response = await fetch(`/api/agents/${agentId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch agent')
      }
      const agentData = await response.json()
      setAgents([agentData])
    } catch (err: any) {
      setAgentError(err.message)
      setAgents([])
    } finally {
      setAgentLoading(false)
    }
  }, [shouldFetch, agentId])

  const refetchAgent = fetchAgent

  React.useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  const agent = shouldFetch ? agents?.[0] : null



  const isVapiAgent = React.useMemo(() => {
    if (!agent) return false
    
    const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
    const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
    const isVapiType = agent.agent_type === 'vapi'
    
    return hasVapiKeys || hasVapiConfig || isVapiType
  }, [agent])

  console.log({agent})


  const [projects, setProjects] = React.useState<any[]>([])
  const [projectLoading, setProjectLoading] = React.useState(true)
  const [projectError, setProjectError] = React.useState<string | null>(null)

  const fetchProject = React.useCallback(async () => {
    if (!shouldFetch || !agent?.project_id) {
      setProjects([])
      setProjectLoading(false)
      return
    }

    setProjectLoading(true)
    setProjectError(null)

    try {
      const response = await fetch(`/api/projects/${agent.project_id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }
      const projectData = await response.json()
      setProjects([projectData])
    } catch (err: any) {
      setProjectError(err.message)
      setProjects([])
    } finally {
      setProjectLoading(false)
    }
  }, [shouldFetch, agent?.project_id])

  React.useEffect(() => {
    fetchProject()
  }, [fetchProject])



  const project = (shouldFetch && agent?.project_id) ? projects?.[0] : null

  useEffect(()=>{
    if(project && agent?.project_id && agent?.name){
      setBreadcrumb({
        project: project.name,
        item: agent.name
      })
    }
  },[project, agent])

  const handleBack = () => {
    if (agent?.project_id) {
      router.push(`/${agent.project_id}/agents`)
    } else {
      router.push('/')
    }
  }

  const handleTabChange = (tab: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('tab', tab)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    router.push(`/agents/${agentId}${query}`)
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'from-red-500 to-red-600 text-white border border-red-400/50'
      case 'staging':
      case 'stage':
        return 'from-orange-500 to-orange-600 text-white border border-orange-400/50'
      case 'development':
      case 'dev':
        return 'from-blue-500 to-blue-600 text-white border border-blue-400/50'
      default:
        return 'from-slate-500 to-slate-600 text-white border border-slate-400/50'
    }
  }

  const getAgentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return 'from-blue-500 to-blue-600 text-white border border-blue-400/50'
      case 'outbound':
        return 'from-green-500 to-green-600 text-white border border-green-400/50'
      case 'custom':
        return 'from-purple-500 to-purple-600 text-white border border-purple-400/50'
      default:
        return 'from-slate-500 to-slate-600 text-white border border-slate-400/50'
    }
  }

  useEffect(() => {
    if (!searchParams.get('tab')) {
      handleTabChange('overview')
    }
  }, [searchParams])

  const isEnhancedProject = agent?.project_id === ENHANCED_PROJECT_ID

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'Call Logs', icon: List },
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : []),
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  // Prepare breadcrumb data for Header


  const checkVapiStatus = useCallback(async () => {
    if (!isVapiAgent || !agent?.id) return
    
    setVapiStatusLoading(true)
    try {
      const response = await fetch(`/api/agents/${agent?.id}/vapi/status`)
      const data = await response.json()
      setVapiStatus(data)
    } catch (error) {
      console.error('Failed to check Vapi status:', error)
      setVapiStatus({
        connected: false,
        status: 'error',
        message: 'Failed to check connection status'
      })
    } finally {
      setVapiStatusLoading(false)
    }
  }, [isVapiAgent, agent?.id])


  const handleWebhookSetup = async () => {
    if (!agent?.id) return
    
    setConnectingWebhook(true)
    try {
      const response = await fetch(`/api/agents/${agent?.id}/vapi/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup webhook')
      }
      
      // Refresh status after successful setup
      await checkVapiStatus()
      
      alert('Webhook configured successfully! Agent is now ready.')
      
    } catch (error) {
      console.error('Failed to setup webhook:', error)
      alert(error instanceof Error ? error.message : 'Failed to setup webhook')
    } finally {
      setConnectingWebhook(false)
    }
  }


  useEffect(() => {
    if (isVapiAgent && agent?.id) {
      checkVapiStatus()
    }
  }, [checkVapiStatus, isVapiAgent, agent?.id])


  if (!shouldFetch) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertCircle className="w-8 h-8 text-white drop-shadow-sm" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-3">Invalid Agent ID</h2>
            <p className="text-sm text-slate-400 mb-6">Agent ID missing or invalid</p>
            <Button onClick={() => router.push('/')} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
              <Home className="h-4 w-4 mr-2" />
              Back to Workspaces
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (agentLoading || (shouldFetch && projectLoading)) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl border border-slate-800/50 shadow-2xl flex items-center justify-center mx-auto backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin text-white drop-shadow-sm" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Loading Dashboard</h3>
              <p className="text-sm text-slate-400">Fetching agent data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (agentError || projectError || !agent) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl shadow-slate-900/25 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <AlertCircle className="w-8 h-8 text-white drop-shadow-sm" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-3">Agent not found</h2>
            <p className="text-sm text-slate-400 mb-6">{agentError || projectError || 'Agent not found'}</p>
            <Button onClick={handleBack} className="w-full bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-200 hover:text-white transition-all duration-300">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header breadcrumb={breadcrumb} />

      {/* Modern Header */}
      <div className="bg-slate-900/50 border-b border-slate-800/50 shadow-2xl shadow-slate-900/25 backdrop-blur-xl">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Navigation & Identity */}
            <div className="flex items-center gap-6">
              <button 
                onClick={handleBack}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-xl transition-all duration-300 border border-slate-700/50 hover:border-slate-600"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-100 via-white to-slate-100 bg-clip-text text-transparent tracking-tight truncate max-w-[250px] cursor-default">
                      {agent?.name || 'Loading...'}
                    </h1>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-900/95 text-slate-100 border-slate-700/50 shadow-2xl backdrop-blur-sm">
                    <p className="font-semibold">{agent?.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{agent?.provider || 'Unknown'} Agent</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r ${getEnvironmentColor(agent?.environment || 'development')} shadow-lg backdrop-blur-sm`}>
                    {agent?.environment || 'development'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Modern Tab Navigation - Responsive */}
            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-800/50 rounded-2xl p-1.5 ml-2 md:ml-8 overflow-x-auto scrollbar-hide backdrop-blur-sm shadow-2xl shadow-slate-900/25">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 transition-all duration-300 ${isActive ? 'drop-shadow-sm' : ''}`} />
                      <span className="hidden sm:inline font-semibold">{tab.label}</span>
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-xl opacity-20 blur-lg -z-10"></div>
                      )}
                    </button>
                  )
                })}
            </div>

            {/* Modern Right Actions */}
            <div className="flex items-center gap-4">
              {isVapiAgent && (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (vapiStatus?.connected) {
                        // Navigate to settings if connected
                        router.push(`/agents/${agentId}/vapi`)
                      } else {
                        // Setup webhook if not connected
                        handleWebhookSetup()
                      }
                    }}
                    className="ml-4"
                    variant="outline"
                    disabled={vapiStatusLoading || connectingWebhook}
                  >
                    {vapiStatusLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : connectingWebhook ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : vapiStatus?.connected ? (
                      <Bot className="w-4 h-4 mr-2" />
                    ) : (
                      <LinkIcon className="w-4 h-4 mr-2" />
                    )}
                  
                  {vapiStatusLoading ? 'Checking...' :
                  connectingWebhook ? 'Connecting...' :
                  vapiStatus?.connected ? 'Agent Settings' : 'Connect VAPI'}
                  </Button>
                
                  {/* Status indicator */}
                  {!vapiStatusLoading && vapiStatus && (
                    <div className="absolute -top-1 -right-1">
                      {vapiStatus.connected ? (
                        <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white" 
                            title="Webhook connected" />
                      ) : (
                        <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white" 
                            title="Setup required" />
                      )}
                    </div>
                  )}
                </div>
              )}

              {agent?.id && (
                <FieldExtractorDialog
                  initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                  isEnabled={!!agent?.field_extractor}
                  onSave={async (fieldData, enabled) => {
                    if (!agent?.id) return
                    
                    try {
                      const response = await fetch(`/api/agents/${agent?.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          field_extractor: enabled,
                          field_extractor_prompt: JSON.stringify(fieldData)
                        })
                      })
                      
                      const result = await response.json()
                      
                      if (result.success) {
                        refetchAgent()
                      }
                    } catch (error) {
                      console.error('Failed to update field extractor:', error)
                    }
                  }}
                />
              )}

              {/* Modern Period Filters */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-400">Period</span>
                <div className="flex items-center gap-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1 backdrop-blur-sm">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleQuickFilter(filter.id)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-300 ${
                        quickFilter === filter.id
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-950/50">
        {activeTab === 'overview' && agent?.id && (
          <Overview 
            key={`overview-${quickFilter}-${apiDateRange.from}-${apiDateRange.to}`}
            project={project} 
            agent={agent}
            dateRange={apiDateRange}
            quickFilter={quickFilter}
            isCustomRange={isCustomRange}
          />
        )}
        {activeTab === 'logs' && agent?.id && (
          <CallLogs project={project} agent={agent} onBack={handleBack} />
        )}
        {activeTab === 'campaign-logs' && isEnhancedProject && agent?.id && (
          <CampaignLogs project={project} agent={agent} onBack={handleBack} />
        )}
        {activeTab === 'analytics' && agent?.id && (
          <AgentAnalytics agent={agent} />
        )}
        {activeTab === 'settings' && agent?.id && (
          <AgentSettings agent={agent} onAgentUpdate={refetchAgent} />
        )}
      </div>
    </div>
  )
}

export default Dashboard