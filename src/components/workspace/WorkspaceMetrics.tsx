'use client'

import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts'
import { Activity, Phone, DollarSign, Users, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, BarChart3, Building, MessageSquare, Timer, Calendar, Star, Headphones, Cpu, Mic, Volume2 } from 'lucide-react'
import { useGlobalRole } from '@/hooks/useGlobalRole'

interface WorkspaceMetricsProps {
  projectId?: string
  workspaceFilter?: string
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
          response = await fetch('/api/metrics/global')
          targetProjectId = null;
        } else {
          targetProjectId = selectedWorkspace || projectId || null;
          if (targetProjectId && targetProjectId !== 'ALL') {
            response = await fetch(`/api/projects/${targetProjectId}/metrics`)
          } else if (!isSuperAdmin && projectId) {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
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
  const usageMetrics = {
    llm: {
      totalTokens: timeSeriesData.reduce((sum, item) => sum + (item.llm_tokens_input || 0) + (item.llm_tokens_output || 0), 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.llm_cost || 0), 0)
    },
    stt: {
      duration: timeSeriesData.reduce((sum, item) => sum + (item.stt_duration || 0), 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.stt_cost || 0), 0)
    },
    tts: {
      characters: timeSeriesData.reduce((sum, item) => sum + (item.tts_characters || 0), 0),
      cost: timeSeriesData.reduce((sum, item) => sum + (item.tts_cost || 0), 0)
    },
    totalMinutes: timeSeriesData.reduce((sum, item) => sum + (item.total_call_duration || 0), 0) / 60,
    totalCost: timeSeriesData.reduce((sum, item) => sum + (item.total_cost || 0), 0)
  }

  console.log('📊 TimeSeriesData sample:', timeSeriesData.slice(0, 2))
  console.log('📊 Usage metrics calculated:', usageMetrics)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Failed to load metrics</p>
      </div>
    )
  }

  const isGlobalView = isSuperAdmin && (selectedWorkspace === 'ALL' || !selectedWorkspace);

  return (
    <div className="space-y-8">
      {/* Usage Metrics Grid */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Usage Metrics</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Usage LLM */}
          <div className="group">
            <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-cyan-50 rounded-lg border border-cyan-100">
                    <Cpu className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-cyan-600 bg-cyan-50 px-2 py-1 rounded-md border border-cyan-100">
                      LLM
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usage LLM</h3>
                  <p className="text-2xl font-light text-gray-900 tracking-tight">{formatNumber(usageMetrics.llm.totalTokens)}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">Tokens</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-900 font-semibold">{formatCurrency(usageMetrics.llm.cost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage STT */}
          <div className="group">
            <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-rose-50 rounded-lg border border-rose-100">
                    <Mic className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                      STT
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usage STT</h3>
                  <p className="text-2xl font-light text-gray-900 tracking-tight">{Math.round(usageMetrics.stt.duration)}s</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">Speech duration</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-900 font-semibold">{formatCurrency(usageMetrics.stt.cost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage TTS */}
          <div className="group">
            <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-violet-50 rounded-lg border border-violet-100">
                    <Volume2 className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-1 rounded-md border border-violet-100">
                      TTS
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usage TTS</h3>
                  <p className="text-2xl font-light text-gray-900 tracking-tight">{formatNumber(usageMetrics.tts.characters)}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">Characters</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-900 font-semibold">{formatCurrency(usageMetrics.tts.cost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Minutes */}
          <div className="group">
            <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-teal-50 rounded-lg border border-teal-100">
                    <Timer className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
                      Total
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Usage Minutes</h3>
                  <p className="text-2xl font-light text-gray-900 tracking-tight">{Math.round(usageMetrics.totalMinutes)}min</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 font-medium">Total duration</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-900 font-semibold">{formatCurrency(usageMetrics.totalCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Simple status display */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">{metrics.totalCalls}</div>
            <div className="text-sm text-gray-600">Total Calls</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{metrics.successRate}%</div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{formatDuration(metrics.averageDuration)}</div>
            <div className="text-sm text-gray-600">Avg Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(metrics.totalCost)}</div>
            <div className="text-sm text-gray-600">Total Cost</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceMetrics
