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
  Check
} from 'lucide-react'
import Overview from './Overview'
import CallLogs from './calls/CallLogs'
import CampaignLogs from './campaigns/CampaignLogs'
import Header from '@/components/shared/Header'

import { useQuery } from '../hooks/useDatabase'
import FieldExtractorDialog from './FieldExtractorLogs'
import { AlertTriangle, Link as LinkIcon } from 'lucide-react'
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
    if (isCustomRange && dateRange.from && dateRange.to) {
      return {
        from: formatDateISO(dateRange.from),
        to: formatDateISO(dateRange.to)
      }
    }
    
    const days = quickFilters.find(f => f.id === quickFilter)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    return {
      from: formatDateISO(startDate),
      to: formatDateISO(endDate)
    }
  }, [quickFilter, dateRange, isCustomRange])

  const handleQuickFilter = (filterId: string) => {
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
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
        return 'bg-red-50 text-red-700 border border-red-100'
      case 'staging':
      case 'stage':
        return 'bg-orange-50 text-orange-700 border border-orange-100'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border border-blue-100'
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-100'
    }
  }

  const getAgentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return 'bg-blue-50 text-blue-700 border border-blue-100'
      case 'outbound':
        return 'bg-green-50 text-green-700 border border-green-100'
      case 'custom':
        return 'bg-purple-50 text-purple-700 border border-purple-100'
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-100'
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
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : [])
  ]

  // Prepare breadcrumb data for Header


  const checkVapiStatus = useCallback(async () => {
    if (!isVapiAgent || !agent?.id) return
    
    setVapiStatusLoading(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/vapi/status`)
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
      const response = await fetch(`/api/agents/${agent.id}/vapi/setup-webhook`, {
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
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Agent ID</h2>
            <p className="text-sm text-gray-500 mb-4">Agent ID missing or invalid</p>
            <Button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
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
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Loading Dashboard</h3>
              <p className="text-sm text-gray-500">Fetching agent data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (agentError || projectError || !agent) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Agent not found</h2>
            <p className="text-sm text-gray-500 mb-4">{agentError || projectError || 'Agent not found'}</p>
            <Button onClick={handleBack} variant="outline" className="w-full border-gray-200">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header breadcrumb={breadcrumb} />

      {/* Polished Apple Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Navigation & Identity */}
            <div className="flex items-center gap-6">
              <button 
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight truncate max-w-[250px] cursor-default">
                      {agent?.name || 'Loading...'}
                    </h1>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{agent?.name || 'Loading...'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs font-medium px-3 py-1 rounded-full ${getEnvironmentColor(agent?.environment || 'development')}`}>
                    {agent?.environment || 'development'}
                  </Badge>
                </div>
              </div>

              {/* Refined Tab Navigation */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 ml-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {isVapiAgent && (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (vapiStatus?.connected) {
                        // Navigate to settings if connected
                        router.push(`/agents/${agentId}/vapi`)
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

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
            </div>

            {/* Right: Refined Controls */}
            <div className="flex items-center gap-6">
              {/* Polished Period Filters */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600">Period</span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleQuickFilter(filter.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        quickFilter === filter.id && !isCustomRange
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`px-4 py-2 text-sm font-medium rounded-lg border-gray-200 transition-all duration-200 ${
                        isCustomRange 
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Custom
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-gray-200 shadow-xl rounded-xl" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                      className="rounded-xl"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {agent?.id && (
                <FieldExtractorDialog
                  initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                  isEnabled={!!agent?.field_extractor}
                  onSave={async (fieldData, enabled) => {
                    if (!agent?.id) return
                    const response = await fetch(`/api/agents/${agent.id}`, {
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
                  const error = !response.ok ? new Error('Failed to update agent') : null
                  if (!error) {
                    alert('Saved field extractor config.')
                    refetchAgent()
                  } else {
                    alert('Error saving config: ' + error.message)
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && agent?.id && (
          <Overview 
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
      </div>
    </div>
  )
}

export default Dashboard