'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts'
import { 
  Activity, 
  Phone, 
  DollarSign, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  CheckCircle, 
  AlertCircle, 
  BarChart3, 
  Building, 
  MessageSquare,
  Timer,
  Calendar,
  Star,
  Headphones,
  Cpu,
  Mic,
  Volume2
} from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface WorkspaceMetricsProps {
  projectId?: string
  workspaceFilter?: string // 'ALL' for super_admin aggregated view or specific workspace ID
}

interface MetricsData {
  totalCalls: number
  successRate: number
  averageDuration: number
  totalCost: number
  activeAgents: number
  todayCalls: number
  weeklyGrowth: number
  avgResponseTime: number
}

interface TimeSeriesData {
  date: string
  timestamp: number
  calls: number
  total_cost: number
  total_usage_cost?: number // From materialized view for PAG agents
  llm_cost: number
  tts_cost: number
  stt_cost: number
  llm_tokens_input: number
  llm_tokens_output: number
  tts_characters: number
  stt_duration: number
  total_call_duration: number
  avg_response_time: number
  completion_rate?: number
  user_satisfaction?: number
  task_success_rate?: number
}

interface AgentComparison {
  agent_name: string
  agent_id: string
  currency: string
  metrics: {
    total_calls: number
    successful_calls: number
    failed_calls: number
    avg_duration: number
    total_cost: number
    completion_rate: number
    user_satisfaction: number
    response_time: number
    llm_usage: {
      total_tokens: number
      input_tokens: number
      output_tokens: number
      requests: number
    }
    tts_usage: {
      characters: number
      duration: number
      requests: number
    }
    stt_usage: {
      duration: number
      requests: number
      accuracy: number
    }
    trends: Array<{
      date: string
      calls: number
      satisfaction: number
      response_time: number
      completion_rate: number
    }>
  }
}

const WorkspaceMetrics: React.FC<WorkspaceMetricsProps> = ({ projectId, workspaceFilter }) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [agentsComparison, setAgentsComparison] = useState<AgentComparison[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState(workspaceFilter || projectId || 'ALL')
  const { isSuperAdmin, isLoading: roleLoading } = useGlobalRole()

  // Fetch available workspaces for super_admin workspace selector
  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (isSuperAdmin) {
        try {
          const response = await fetch('/api/projects')
          if (response.ok) {
            const workspaces = await response.json()
            setAvailableWorkspaces(workspaces)
          }
        } catch (err) {
          console.error('Failed to fetch workspaces:', err)
        }
      }
    }

    if (!roleLoading && isSuperAdmin) {
      fetchWorkspaces()
    }
  }, [isSuperAdmin, roleLoading])

  // Main data fetching effect
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        let response;
        let targetProjectId: string | null = selectedWorkspace || null;
        
        if (isSuperAdmin && (selectedWorkspace === 'ALL' || !selectedWorkspace)) {
          // Superadmin sees global metrics across all workspaces
          response = await fetch('/api/metrics/global')
          targetProjectId = null; // Indicates global view
        } else {
          // User sees specific workspace metrics or super_admin selected specific workspace
          targetProjectId = selectedWorkspace || projectId || null;
          if (targetProjectId && targetProjectId !== 'ALL') {
            response = await fetch(`/api/projects/${targetProjectId}/metrics`)
          } else if (!isSuperAdmin && projectId) {
            // For regular users, always use their assigned projectId
            targetProjectId = projectId;
            response = await fetch(`/api/projects/${projectId}/metrics`)
          } else {
            throw new Error('No workspace specified')
          }
        }
        
        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }
        
        const data = await response.json()
        setMetrics(data)

        // Fetch time series data
        const timeSeriesUrl = targetProjectId 
          ? `/api/metrics/timeseries?projectId=${targetProjectId}&period=${selectedPeriod}&metric=all`
          : `/api/metrics/timeseries?period=${selectedPeriod}&metric=all`;
        console.log('🔍 Fetching timeseries:', timeSeriesUrl)
        const timeSeriesResponse = await fetch(timeSeriesUrl)
        if (timeSeriesResponse.ok) {
          const timeSeriesResult = await timeSeriesResponse.json()
          console.log('📊 TimeSeries data:', timeSeriesResult)
          setTimeSeriesData(timeSeriesResult.data || [])
        } else {
          console.error('❌ TimeSeries fetch failed:', timeSeriesResponse.status, await timeSeriesResponse.text())
        }

        // Fetch agents comparison data  
        const agentsUrl = targetProjectId
          ? `/api/metrics/agents-comparison?projectId=${targetProjectId}&period=${selectedPeriod}`
          : `/api/metrics/agents-comparison?period=${selectedPeriod}`;
        console.log('🔍 Fetching agents:', agentsUrl)
        const agentsResponse = await fetch(agentsUrl)
        if (agentsResponse.ok) {
          const agentsResult = await agentsResponse.json()
          console.log('👥 Agents data:', agentsResult)
          setAgentsComparison(agentsResult.data || [])
        } else {
          console.error('❌ Agents fetch failed:', agentsResponse.status, await agentsResponse.text())
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metrics data')
        console.error('Failed to fetch workspace metrics:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!roleLoading && (projectId || isSuperAdmin || selectedWorkspace)) {
      fetchDashboardData()
    }
  }, [projectId, isSuperAdmin, roleLoading, selectedWorkspace, selectedPeriod])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(navigator.language, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toLocaleString()
  }

  // Calculate usage metrics from time series data
  console.log('🔍 DEBUG TimeSeriesData:', timeSeriesData)
  console.log('🔍 DEBUG Sample item:', timeSeriesData[0])
  
  const usageMetrics = {
    llm: {
      totalTokens: timeSeriesData.reduce((sum, item) => {
        const tokens = (item.llm_tokens_input || 0) + (item.llm_tokens_output || 0)
        console.log(`📊 LLM tokens for ${item.date}: input=${item.llm_tokens_input}, output=${item.llm_tokens_output}, total=${tokens}`)
        return sum + tokens
      }, 0),
      cost: timeSeriesData.reduce((sum, item) => {
        console.log(`💰 LLM cost for ${item.date}: ${item.llm_cost}`)
        return sum + (item.llm_cost || 0)
      }, 0)
    },
    stt: {
      duration: timeSeriesData.reduce((sum, item) => {
        console.log(`🎤 STT duration for ${item.date}: ${item.stt_duration}`)
        return sum + (item.stt_duration || 0)
      }, 0),
      cost: timeSeriesData.reduce((sum, item) => {
        console.log(`💰 STT cost for ${item.date}: ${item.stt_cost}`)
        return sum + (item.stt_cost || 0)
      }, 0)
    },
    tts: {
      characters: timeSeriesData.reduce((sum, item) => {
        console.log(`🔊 TTS characters for ${item.date}: ${item.tts_characters}`)
        return sum + (item.tts_characters || 0)
      }, 0),
      cost: timeSeriesData.reduce((sum, item) => {
        console.log(`💰 TTS cost for ${item.date}: ${item.tts_cost}`)
        return sum + (item.tts_cost || 0)
      }, 0)
    },
    totalMinutes: timeSeriesData.reduce((sum, item) => {
      console.log(`⏱️ Total duration for ${item.date}: ${item.total_call_duration}s = ${(item.total_call_duration || 0) / 60}min`)
      return sum + (item.total_call_duration || 0)
    }, 0) / 60,
    // Use materialized view total_cost (includes dedicated costs for dedicated/hybrid agents)
    totalCost: timeSeriesData.reduce((sum, item) => {
      // Prefer total_usage_cost from materialized view if available, fallback to total_cost
      const cost = item.total_usage_cost || item.total_cost || 0;
      console.log(`💰 Total cost for ${item.date}: ${cost} (usage cost from materialized view)`)
      return sum + cost;
    }, 0)
  }
  
  console.log('📈 FINAL Usage Metrics:', usageMetrics)

  // Transform agents comparison data for the table
  console.log('🔍 DEBUG AgentsComparison:', agentsComparison)
  
  const agentsData = agentsComparison.map(agent => {
    console.log(`👤 Agent ${agent.agent_name}: avg_duration=${agent.metrics.avg_duration}s`)
    return {
      name: agent.agent_name,
      calls: agent.metrics.total_calls,
      successRate: Math.round((agent.metrics.successful_calls / agent.metrics.total_calls) * 100) || 0,
      avgDuration: Math.round(agent.metrics.avg_duration),
      totalCost: formatCurrency(agent.metrics.total_cost, agent.currency),
      trend: agent.metrics.completion_rate > 80 ? 'up' : agent.metrics.completion_rate < 50 ? 'down' : 'stable',
      trendValue: Math.round((agent.metrics.completion_rate - 70) / 2) // Mock trend calculation
    }
  })
  
  console.log('📊 DEBUG Metrics card avg_duration:', metrics?.averageDuration)
  console.log('📋 DEBUG Table agents avg_duration:', agentsData.map(a => `${a.name}: ${a.avgDuration}s`))

  const pieData = metrics ? [
    { name: 'Réussi', value: metrics.successRate },
    { name: 'Échec', value: 100 - metrics.successRate }
  ] : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-200 h-80 rounded-xl"></div>
            <div className="bg-gray-200 h-80 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 dark:text-gray-300">Failed to load metrics</p>
      </div>
    )
  }

  const isGlobalView = isSuperAdmin && (selectedWorkspace === 'ALL' || !selectedWorkspace);
  const metricsTitle = isGlobalView ? 'Global Metrics' : 'Workspace Metrics'
  const metricsDescription = isGlobalView ? 'Across all workspaces' : 'Current workspace'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{metricsTitle}</h1>
          <div className="flex items-center gap-4">
            {/* Workspace Selector for Super Admin */}
            {isSuperAdmin && (
              <select 
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="text-sm border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Workspaces</option>
                {availableWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Building className="w-4 h-4" />
              <span>{isGlobalView ? 'All Workspaces' : (availableWorkspaces.find(w => w.id === selectedWorkspace)?.name || 'Current workspace')}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{metricsDescription}</p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Time Period</span>
        </div>
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          {['7d', '30d', '90d'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedPeriod === period
                  ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'
              }`}
            >
              {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Usage Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Usage LLM - Tokens & Cost */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-100 dark:border-cyan-800">
                  <Cpu className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md border border-cyan-100">
                    LLM
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">LLM USAGE</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatNumber(usageMetrics.llm.totalTokens)} tokens</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-400 font-medium">Tokens</p>
                  <DollarSign className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(usageMetrics.llm.cost)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage STT - Duration & Cost */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-800">
                  <Mic className="w-5 h-5 text-rose-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                    STT
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage STT</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{Math.round(usageMetrics.stt.duration)}s</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-400 font-medium">Speech duration</p>
                  <DollarSign className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(usageMetrics.stt.cost)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage TTS - Characters & Cost */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800">
                  <Volume2 className="w-5 h-5 text-violet-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-md border border-violet-100">
                    TTS
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage TTS</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatNumber(usageMetrics.tts.characters)} chars</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-400 font-medium">Characters</p>
                  <DollarSign className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(usageMetrics.tts.cost)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Minutes & Total Cost */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-100 dark:border-teal-800">
                  <Timer className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
                    Total
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Usage</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatNumber(usageMetrics.totalMinutes)} min</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-gray-400 font-medium">Total duration</p>
                  <DollarSign className="w-3 h-3 text-gray-400" />
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{formatCurrency(usageMetrics.totalCost)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 my-8"></div>

      {/* General Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-100 dark:border-green-800">
                    +{metrics.todayCalls} today
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{isGlobalView ? 'Total Calls (ALL)' : 'Total Calls'}</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{metrics.totalCalls.toLocaleString()}</p>
                <p className="text-xs text-gray-400 font-medium">Current period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Excellent</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Success Rate</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{metrics.successRate}%</p>
                <p className="text-xs text-gray-400 font-medium">Call completion rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-md">
                    +{metrics.weeklyGrowth}% week
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Duration</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatDuration(metrics.averageDuration)}</p>
                <p className="text-xs text-gray-400 font-medium">Per conversation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500">USD</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cost</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatCurrency(metrics.totalCost)}</p>
                <p className="text-xs text-gray-400 font-medium">This month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Agents */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-600">All running</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Agents</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{metrics.activeAgents}</p>
                <p className="text-xs text-gray-400 font-medium">Voice assistants</p>
              </div>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md border border-green-100 dark:border-green-800">
                    <Activity className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Fast</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Response</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{metrics.avgResponseTime}s</p>
                <p className="text-xs text-gray-400 font-medium">Processing speed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Per Call */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingUp className="w-3 h-3 text-red-600" />
                    <span className="text-xs font-bold text-red-600">Monitor</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost Per Call</h3>
                <p className="text-2xl font-light text-gray-900 dark:text-gray-100 tracking-tight">{formatCurrency(metrics.totalCost / metrics.totalCalls)}</p>
                <p className="text-xs text-gray-400 font-medium">Average cost</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Growth */}
        <div className="group">
          <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-slate-600 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md border ${metrics.weeklyGrowth >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
                    {metrics.weeklyGrowth >= 0 ? <TrendingUp className="w-3 h-3 text-green-600" /> : <TrendingDown className="w-3 h-3 text-red-600" />}
                    <span className={`text-xs font-bold ${metrics.weeklyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.weeklyGrowth >= 0 ? 'Growing' : 'Declining'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Weekly Growth</h3>
                <p className={`text-2xl font-light tracking-tight ${metrics.weeklyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.weeklyGrowth >= 0 ? '+' : ''}{metrics.weeklyGrowth}%
                </p>
                <p className="text-xs text-gray-400 font-medium">This week</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Daily Call Volume</h3>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-slate-400">Last {selectedPeriod === '7d' ? '7' : selectedPeriod === '30d' ? '30' : '90'} days period</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" className="dark:[&>*]:stroke-slate-700" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--tooltip-bg)', 
                      border: '1px solid var(--tooltip-border)', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'var(--tooltip-text)'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="calls" 
                    stroke="#3B82F6" 
                    fillOpacity={1} 
                    fill="url(#colorCalls)"
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 3 }}
                    activeDot={{ r: 4, fill: '#1d4ed8' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Phone className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucun appel pour cette période</p>
                  <p className="text-xs text-gray-400">Essayez une période plus large</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Success Analysis */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-50 rounded flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Success Analysis</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs text-gray-500">Success Rate</div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">{metrics?.successRate || 0}%</div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  <Cell fill="#3B82F6" />
                  <Cell fill="#475569" />
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-gray-600 dark:text-slate-300">Successful</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                <span className="text-xs text-gray-600 dark:text-slate-300">Failed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Minutes */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usage Minutes</h3>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Daily conversation duration</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" className="dark:[&>*]:stroke-slate-700" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--tooltip-bg)', 
                      border: '1px solid var(--tooltip-border)', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'var(--tooltip-text)'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total_call_duration" 
                    stroke="#3B82F6" 
                    fill="url(#colorMinutes)" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', r: 3 }}
                    activeDot={{ r: 4, fill: '#1d4ed8' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucune donnée de durée</p>
                  <p className="text-xs text-gray-400">Vérifiez la période sélectionnée</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Response Performance */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-50 dark:bg-purple-900/20 rounded flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response Performance</h3>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Average latency metrics</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" className="dark:[&>*]:stroke-slate-700" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--tooltip-bg)', 
                      border: '1px solid var(--tooltip-border)', 
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'var(--tooltip-text)'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg_response_time" 
                    stroke="#8B5CF6" 
                    strokeWidth={2} 
                    dot={{ fill: '#8B5CF6', r: 3 }}
                    activeDot={{ r: 4, fill: '#7C3AED' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Aucune donnée de performance</p>
                  <p className="text-xs text-gray-400">Données de latence indisponibles</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agents Performance Table */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-50 rounded flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Agent Performance</h3>
            </div>
            <div className="text-xs text-gray-500">
              {agentsData.length} active agents
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Calls</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Success Rate</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Duration</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Cost</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {agentsData.length > 0 ? (
                agentsData.map((agent, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">
                            {agent.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{agent.name}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">Active</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-900 dark:text-slate-300">{agent.calls.toLocaleString()}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          agent.successRate >= 90
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                            : agent.successRate >= 70
                            ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                            : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        }`}>
                          {agent.successRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-gray-900 dark:text-slate-300">{formatDuration(agent.avgDuration)}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-300">${agent.totalCost}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {agent.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : agent.trend === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                          <div className="w-4 h-4 bg-gray-300 rounded-full" />
                        )}
                        <span className={`text-xs font-medium ${
                          agent.trend === 'up' ? 'text-green-600' : 
                          agent.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {agent.trendValue > 0 ? '+' : ''}{agent.trendValue}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 px-6">
                    <div className="text-center text-gray-500">
                      <Headphones className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Aucun agent trouvé</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Aucune donnée d'agent disponible pour cette période ou ce workspace
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceMetrics
