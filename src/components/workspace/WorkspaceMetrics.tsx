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
  Headphones
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
        const timeSeriesResponse = await fetch(timeSeriesUrl)
        if (timeSeriesResponse.ok) {
          const timeSeriesResult = await timeSeriesResponse.json()
          setTimeSeriesData(timeSeriesResult.data || [])
        }

        // Fetch agents comparison data  
        const agentsUrl = targetProjectId
          ? `/api/metrics/agents-comparison?projectId=${targetProjectId}&period=${selectedPeriod}`
          : `/api/metrics/agents-comparison?period=${selectedPeriod}`;
        const agentsResponse = await fetch(agentsUrl)
        if (agentsResponse.ok) {
          const agentsResult = await agentsResponse.json()
          setAgentsComparison(agentsResult.data || [])
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
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Transform agents comparison data for the table
  const agentsData = agentsComparison.map(agent => ({
    name: agent.agent_name,
    calls: agent.metrics.total_calls,
    successRate: Math.round((agent.metrics.successful_calls / agent.metrics.total_calls) * 100) || 0,
    avgDuration: Math.round(agent.metrics.avg_duration),
    totalCost: agent.metrics.total_cost.toFixed(2),
    trend: agent.metrics.completion_rate > 80 ? 'up' : agent.metrics.completion_rate < 50 ? 'down' : 'stable',
    trendValue: Math.round((agent.metrics.completion_rate - 70) / 2) // Mock trend calculation
  }))

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
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">Failed to load metrics</p>
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
          <h1 className="text-lg font-semibold text-gray-900">{metricsTitle}</h1>
          <div className="flex items-center gap-4">
            {/* Workspace Selector for Super Admin */}
            {isSuperAdmin && (
              <select 
                value={selectedWorkspace}
                onChange={(e) => setSelectedWorkspace(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ALL">All Workspaces</option>
                {availableWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building className="w-4 h-4" />
              <span>{isGlobalView ? 'All Workspaces' : (availableWorkspaces.find(w => w.id === selectedWorkspace)?.name || 'Current workspace')}</span>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-500">{metricsDescription}</p>
      </div>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Time Period</span>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['7d', '30d', '90d'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    +{metrics.todayCalls} today
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isGlobalView ? 'Total Calls (ALL)' : 'Total Calls'}</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.totalCalls.toLocaleString()}</p>
                <p className="text-xs text-gray-400 font-medium">Current period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Success Rate */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-green-50 rounded-lg border border-green-100">
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
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Success Rate</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.successRate}%</p>
                <p className="text-xs text-gray-400 font-medium">Call completion rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Average Duration */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                    +{metrics.weeklyGrowth}% week
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Duration</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatDuration(metrics.averageDuration)}</p>
                <p className="text-xs text-gray-400 font-medium">Per conversation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Cost */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-gray-500">USD</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Cost</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatCurrency(metrics.totalCost)}</p>
                <p className="text-xs text-gray-400 font-medium">This month</p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Agents */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
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
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Agents</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.activeAgents}</p>
                <p className="text-xs text-gray-400 font-medium">Voice assistants</p>
              </div>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-purple-50 rounded-lg border border-purple-100">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <Activity className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Fast</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Response</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{metrics.avgResponseTime}s</p>
                <p className="text-xs text-gray-400 font-medium">Processing speed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Per Call */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-orange-50 rounded-lg border border-orange-100">
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
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Per Call</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">{formatCurrency(metrics.totalCost / metrics.totalCalls)}</p>
                <p className="text-xs text-gray-400 font-medium">Average cost</p>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Growth */}
        <div className="group">
          <div className="bg-white border border-gray-300 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-600">Growing</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Weekly Growth</h3>
                <p className="text-2xl font-light text-gray-900 tracking-tight">+{metrics.weeklyGrowth}%</p>
                <p className="text-xs text-gray-400 font-medium">This week</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Daily Call Volume</h3>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">Last {selectedPeriod === '7d' ? '7' : selectedPeriod === '30d' ? '30' : '90'} days period</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" />
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
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
          </div>
        </div>

        {/* Success Analysis */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-50 rounded flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Success Analysis</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs text-gray-500">Success Rate</div>
                  <div className="text-lg font-semibold text-gray-900">{metrics?.successRate || 0}%</div>
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
                  <Cell fill="#E5E7EB" />
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
                <span className="text-xs text-gray-600">Successful</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                <span className="text-xs text-gray-600">Failed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Minutes */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-50 rounded flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Usage Minutes</h3>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-500">Daily conversation duration</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" />
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
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
          </div>
        </div>

        {/* Response Performance */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-50 rounded flex items-center justify-center">
                  <Activity className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900">Response Performance</h3>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Average latency metrics</span>
              </div>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="1 1" stroke="#f1f5f9" />
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
                    backgroundColor: 'white', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
          </div>
        </div>
      </div>

      {/* Agents Performance Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-50 rounded flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Agent Performance</h3>
            </div>
            <div className="text-xs text-gray-500">
              {agentsData.length} active agents
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Duration</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cost</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agentsData.map((agent, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {agent.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                        <div className="text-xs text-gray-500">Active</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900">{agent.calls.toLocaleString()}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        agent.successRate >= 90 
                          ? 'bg-green-100 text-green-800' 
                          : agent.successRate >= 70 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.successRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-900">{agent.avgDuration}s</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm font-medium text-gray-900">${agent.totalCost}</div>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceMetrics
